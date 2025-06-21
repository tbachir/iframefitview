/**
 * Health Monitor - Système de surveillance complet pour HuddleBoard
 * Auto-fonctionnel : suffit d'importer le script
 * Version: 2.1 - Corrections critiques
 */

// =============================================================================
// CONFIGURATION - Modifier ici si nécessaire
// =============================================================================

const HEALTH_CONFIG = {
    // Intervalles (en millisecondes)
    healthCheckInterval: 30000,        // Vérification santé générale
    memoryCheckInterval: 30000,        // Vérification mémoire spécifique
    uiUpdateInterval: 30000,            // Mise à jour interface

    // Seuils d'alerte - VALEURS CORRIGÉES
    memoryThreshold: 40,               // % mémoire avant alerte
    performanceThreshold: 50,          // ms pour Long Task (était 1000, maintenant 50)
    errorThreshold: 10,                 // erreurs consécutives max
    memoryWarningLimit: 3,             // alertes mémoire avant action

    // Auto-récupération
    autoRecover: true,                 // Tentatives auto de récupération
    maxRecoveryAttempts: 3,            // Tentatives max avant abandon
    recoveryDelay: 60000,               // Délai entre tentatives
    preventiveReloadAfter: 12 * 60 * 60 * 1000, // 12h

    // Interface utilisateur
    logLevel: 'warn',                  // console log level

    // Monitoring avancé
    trackPerformanceMetrics: true,     // Surveiller Web Vitals
    trackMemoryLeaks: true             // Détecter fuites mémoire
};

// =============================================================================
// CLASSE PRINCIPALE
// =============================================================================

class HealthMonitor {
    constructor() {
        this.config = { ...HEALTH_CONFIG };
        this.isInitialized = false;
        this.isActive = false;

        // État du système
        this.state = {
            startTime: Date.now(),
            uptime: 0,
            healthScore: 100,
            status: 'initializing', // initializing, healthy, warning, critical

            // Compteurs séparés par type d'erreur
            refreshCount: 0,
            systemErrorCount: 0,    // Erreurs critiques système
            networkErrorCount: 0,   // Erreurs réseau (non-critiques)
            recoveryAttempts: 0,
            memoryWarnings: 0,

            // Dernières mesures
            lastError: null,
            lastMemoryCheck: null,
            lastPerformanceCheck: null,

            // Historique (dernières 50 entrées)
            memoryHistory: [],
            performanceHistory: [],
            errorHistory: []
        };

        // Timers - stockage des IDs pour cleanup proper
        this.timers = {
            healthCheck: null,
            memoryCheck: null,
            uiUpdate: null,
            preventiveReload: null
        };

        // Éléments UI
        this.ui = {
            button: null,
            overlay: null,
            panel: null,
        };

        // Métriques performance
        this.metrics = {
            memoryPeak: 0,
            slowOperations: 0,
            networkErrors: 0,
            crashRecoveries: 0
        };

        // Observers - pour cleanup proper
        this.observers = {
            performance: null,
        };

        // Bound methods pour éviter les problèmes de contexte
        this.boundMethods = {
            handleError: this.handleGlobalError.bind(this),
            handleRejection: this.handleUnhandledRejection.bind(this),
            handleResourceError: this.handleResourceError.bind(this)
        };
    }

    // =========================================================================
    // INITIALISATION
    // =========================================================================

    /**
     * Initialise le monitoring
     */
    init() {
        if (this.isInitialized) {
            console.warn('⚠️ HealthMonitor déjà initialisé');
            return false;
        }

        console.log('🚀 Initialisation HealthMonitor v2.1');

        try {
            this.setupGlobalErrorHandlers();
            this.createUI();
            this.startMonitoring();
            this.schedulePreventiveReload();

            this.isInitialized = true;
            this.isActive = true;
            this.state.status = 'healthy';

            console.log('✅ HealthMonitor initialisé avec succès');
            return true;

        } catch (error) {
            console.error('❌ Échec initialisation HealthMonitor:', error);
            this.state.status = 'critical';
            this.recordError({
                type: 'initialization',
                message: 'Échec initialisation HealthMonitor',
                error: error
            });
            return false;
        }
    }

    /**
     * Configure les gestionnaires d'erreurs globaux
     */
    setupGlobalErrorHandlers() {
        // Erreurs JavaScript
        window.addEventListener('error', this.boundMethods.handleError);

        // Promesses rejetées
        window.addEventListener('unhandledrejection', this.boundMethods.handleRejection);

        // Erreurs de ressources (images, scripts, etc.)
        window.addEventListener('error', this.boundMethods.handleResourceError, true);
    }

    /**
     * Gestionnaire d'erreurs JavaScript global
     */
    handleGlobalError(event) {
        this.recordError({
            type: 'javascript',
            message: event.message || 'Unknown JavaScript error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack
        });
    }

    /**
     * Gestionnaire de promesses rejetées
     */
    handleUnhandledRejection(event) {
        this.recordError({
            type: 'unhandled_promise',
            message: event.reason?.message || 'Unhandled promise rejection',
            reason: event.reason
        });
    }

    /**
     * Gestionnaire d'erreurs de ressources
     */
    handleResourceError(event) {
        if (event.target !== window) {
            this.recordError({
                type: 'resource',
                message: `Failed to load resource: ${event.target.src || event.target.href}`,
                element: event.target.tagName,
                url: event.target.src || event.target.href
            });
        }
    }

    // =========================================================================
    // MONITORING CORE
    // =========================================================================

    /**
     * Démarre tous les timers de monitoring
     */
    startMonitoring() {
        // Vérification santé générale
        this.timers.healthCheck = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        // Vérification mémoire spécifique
        this.timers.memoryCheck = setInterval(() => {
            this.checkMemoryUsage();
        }, this.config.memoryCheckInterval);

        // Mise à jour interface
        this.timers.uiUpdate = setInterval(() => {
            this.updateUI();
        }, this.config.uiUpdateInterval);

        // Premier check immédiat
        setTimeout(() => {
            this.performHealthCheck();
            this.checkMemoryUsage();
            this.updateUI();
        }, 1000);
    }

    /**
     * Effectue une vérification complète de santé
     */
    performHealthCheck() {
        if (!this.isActive) return;

        try {
            this.state.uptime = Date.now() - this.state.startTime;

            // Vérifier les performances
            this.checkPerformance();

            // Calculer le score de santé
            this.calculateHealthScore();

            // Détecter les problèmes critiques
            this.detectCriticalIssues();

            // Auto-récupération si nécessaire
            if (this.config.autoRecover && this.state.status === 'critical') {
                this.attemptRecovery();
            }

        } catch (error) {
            this.recordError({
                type: 'health_check',
                message: 'Erreur lors de la vérification de santé',
                error: error
            });
        }
    }

    /**
     * Vérifie l'utilisation mémoire
     */
    async checkMemoryUsage() {
        try {
            const memoryInfo = await this.getMemoryInfo();
            if (!memoryInfo) return;

            this.state.lastMemoryCheck = {
                timestamp: Date.now(),
                data: memoryInfo
            };

            // Ajouter à l'historique
            this.addToHistory('memory', memoryInfo);

            // Vérifier les seuils
            if (memoryInfo.usagePercent > this.config.memoryThreshold) {
                this.state.memoryWarnings++;
                this.recordError({
                    type: 'memory_warning',
                    message: `Utilisation mémoire élevée: ${memoryInfo.usagePercent.toFixed(1)}%`,
                    data: memoryInfo
                });

                // Action si trop d'alertes
                if (this.shouldTriggerMemoryRecovery()) {
                    this.triggerMemoryRecovery();
                }
            }

            // Suivre le pic mémoire
            if (memoryInfo.usagePercent > this.metrics.memoryPeak) {
                this.metrics.memoryPeak = memoryInfo.usagePercent;
            }

        } catch (error) {
            this.recordError({
                type: 'memory_check',
                message: 'Erreur lors de la vérification mémoire',
                error: error
            });
        }
    }

    /**
     * Détermine si une récupération mémoire doit être déclenchée
     */
    shouldTriggerMemoryRecovery() {
        return this.state.memoryWarnings > this.config.memoryWarningLimit;
    }

    /**
     * Détermine si le système doit ralentir
     */
    shouldSlowDown(consecutiveErrors) {
        return consecutiveErrors >= this.config.errorThreshold;
    }

    /**
     * Vérifie les performances générales
     */
    checkPerformance() {
        try {
            // Mesurer les performances de rendu actuelles
            const paintEntries = performance.getEntriesByType('paint');
            const navigationEntries = performance.getEntriesByType('navigation');

            let performanceScore = 'excellent';
            let hasSlowOperation = false;

            // Vérifier les métriques de navigation si disponibles
            if (navigationEntries.length > 0) {
                const nav = navigationEntries[0];
                const domContentLoaded = nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart;
                const loadComplete = nav.loadEventEnd - nav.loadEventStart;

                if (domContentLoaded > 1000 || loadComplete > 2000) {
                    performanceScore = 'poor';
                    hasSlowOperation = true;
                } else if (domContentLoaded > 500 || loadComplete > 1000) {
                    performanceScore = 'fair';
                }
            }

            // Vérifier les métriques de paint
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            if (fcp && fcp.startTime > 1500) {
                performanceScore = 'poor';
                hasSlowOperation = true;
            } else if (fcp && fcp.startTime > 800) {
                performanceScore = 'fair';
            }

            // Enregistrer une opération lente seulement si vraiment détectée
            if (hasSlowOperation) {
                this.metrics.slowOperations++;
                this.recordError({
                    type: 'performance',
                    message: `Performance dégradée détectée: ${performanceScore}`,
                    details: {
                        fcp: fcp?.startTime || 'N/A',
                        score: performanceScore
                    }
                });
            }

            // Ajouter à l'historique avec des métriques réelles
            this.addToHistory('performance', {
                timestamp: Date.now(),
                score: performanceScore,
                fcp: fcp?.startTime || null,
                hasSlowOperation: hasSlowOperation
            });

            // Démarrer la surveillance des Long Tasks si disponible
            if (this.config.trackPerformanceMetrics && 'PerformanceObserver' in window) {
                this.trackWebVitals();
            }

        } catch (error) {
            this.recordError({
                type: 'performance_check',
                message: 'Erreur lors de la vérification performance',
                error: error
            });
        }
    }

    // =========================================================================
    // GESTION MÉMOIRE
    // =========================================================================

    /**
     * Récupère les informations mémoire complètes
     */
    async getMemoryInfo() {
        // Vérifier si l'API complète est disponible
        if (this.isMemoryAPIAvailable()) {
            try {
                const memoryInfo = await performance.measureUserAgentSpecificMemory();
                return this.parseFullMemoryInfo(memoryInfo);
            } catch (error) {
                console.warn('⚠️ API mémoire complète échouée, fallback vers JS heap:', error.message);
            }
        }

        // Fallback vers l'API JavaScript
        if (performance.memory) {
            return this.parseJSMemoryInfo();
        }

        return null;
    }

    /**
     * Vérifie si l'API mémoire complète est disponible
     */
    isMemoryAPIAvailable() {
        return window.crossOriginIsolated &&
            typeof performance.measureUserAgentSpecificMemory === 'function';
    }

    /**
     * Parse les infos de l'API mémoire complète
     */
    parseFullMemoryInfo(memoryInfo) {
        const MB = 1024 * 1024;
        let totalBytes = 0;

        if (memoryInfo.breakdown && Array.isArray(memoryInfo.breakdown)) {
            memoryInfo.breakdown.forEach(entry => {
                if (entry && typeof entry.bytes === 'number') {
                    totalBytes += entry.bytes;
                }
            });
        }

        // Estimation de la limite (approximative)
        const estimatedLimit = performance.memory ? performance.memory.jsHeapSizeLimit * 3 : totalBytes * 4;
        const usagePercent = estimatedLimit > 0 ? (totalBytes / estimatedLimit) * 100 : 0;

        return {
            api: 'full',
            usedMB: Number((totalBytes / MB).toFixed(1)),
            limitMB: Number((estimatedLimit / MB).toFixed(1)),
            usagePercent: Number(usagePercent.toFixed(2)),
            breakdown: memoryInfo.breakdown ? memoryInfo.breakdown.map(entry => ({
                type: entry.attribution?.[0]?.scope || 'unknown',
                sizeMB: Number((entry.bytes / MB).toFixed(2))
            })) : []
        };
    }

    /**
     * Parse les infos de l'API JavaScript
     */
    parseJSMemoryInfo() {
        const MB = 1024 * 1024;
        const memory = performance.memory;

        if (!memory) return null;

        const used = memory.usedJSHeapSize || 0;
        const limit = memory.jsHeapSizeLimit || 1;
        const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

        return {
            api: 'js-only',
            usedMB: Number((used / MB).toFixed(1)),
            limitMB: Number((limit / MB).toFixed(1)),
            usagePercent: Number(usagePercent.toFixed(2)),
            totalMB: Number(((memory.totalJSHeapSize || 0) / MB).toFixed(1))
        };
    }

    // =========================================================================
    // AUTO-RÉCUPÉRATION
    // =========================================================================

    /**
     * Calcule le score de santé global - VERSION AVEC DISTINCTION D'ERREURS
     */
    calculateHealthScore() {
        let score = 100;

        // Pénalités basées sur les erreurs SYSTÈME uniquement
        score -= this.state.systemErrorCount * 5;  // Plus lourd pour erreurs système
        score -= this.state.memoryWarnings * 5;
        score -= this.metrics.slowOperations * 3;

        // Pénalités légères pour erreurs réseau (n'empêchent pas le fonctionnement)
        score -= Math.min(this.state.networkErrorCount * 0.5, 10); // Max 10 points pour réseau

        // Bonus pour la stabilité
        const uptimeHours = this.state.uptime / (1000 * 60 * 60);
        if (uptimeHours > 1 && this.state.systemErrorCount === 0) {
            score += Math.min(uptimeHours * 0.5, 10);
        }

        this.state.healthScore = Math.max(0, Math.min(100, score));

        // Déterminer le statut SEULEMENT basé sur les erreurs système
        if (score >= 90) {
            this.state.status = 'healthy';
        } else if (score >= 70) {
            this.state.status = 'warning';
        } else if (this.state.systemErrorCount >= this.config.errorThreshold) {
            // CRITIQUE seulement si erreurs système
            this.state.status = 'critical';
        } else {
            // Même avec beaucoup d'erreurs réseau, max "warning"
            this.state.status = 'warning';
        }
    }

    /**
     * Détecte les problèmes critiques - VERSION SANS ERREURS RÉSEAU
     */
    detectCriticalIssues() {
        // Trop d'erreurs système consécutives (pas réseau)
        if (this.state.systemErrorCount >= this.config.errorThreshold) {
            this.state.status = 'critical';
        }

        // Mémoire critique
        if (this.state.lastMemoryCheck?.data?.usagePercent > 95) {
            this.state.status = 'critical';
        }

        // Performance très dégradée
        if (this.metrics.slowOperations > 10) {
            this.state.status = 'critical';
        }

        // Note: Les erreurs réseau n'entraînent JAMAIS un statut critique
    }

    /**
     * Tente une récupération automatique
     */
    attemptRecovery() {
        if (this.state.recoveryAttempts >= this.config.maxRecoveryAttempts) {
            console.error('❌ Nombre maximum de tentatives de récupération atteint');
            return;
        }

        this.state.recoveryAttempts++;
        console.log(`🔄 Tentative de récupération #${this.state.recoveryAttempts}`);

        setTimeout(() => {
            try {
                // Nettoyer les ressources
                this.cleanupResources();

                // Réinitialiser les compteurs d'erreurs système (pas réseau)
                this.state.systemErrorCount = Math.floor(this.state.systemErrorCount / 2);
                this.state.memoryWarnings = 0;
                this.metrics.slowOperations = 0;
                // Note: On garde networkErrorCount pour info, mais ne l'impacte pas

                // Recharger la page si critique
                if (this.state.status === 'critical' && this.state.recoveryAttempts >= 2) {
                    console.log('🔄 Rechargement de la page pour récupération');
                    this.metrics.crashRecoveries++;
                    window.location.reload();
                }

            } catch (error) {
                console.error('❌ Échec de la récupération:', error);
                this.recordError({
                    type: 'recovery_failed',
                    message: 'Échec de la récupération automatique',
                    error: error
                });
            }
        }, this.config.recoveryDelay);
    }

    /**
     * Déclenche une récupération mémoire
     */
    triggerMemoryRecovery() {
        console.log('🧹 Tentative de récupération mémoire');

        try {
            // Forcer le garbage collection si possible
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
            }

            // Nettoyer les caches
            this.cleanupResources();

            // Réduire l'historique
            this.trimHistory();

            // Recharger si toujours critique
            setTimeout(() => {
                if (this.state.memoryWarnings > this.config.memoryWarningLimit * 2) {
                    console.log('🔄 Rechargement pour libérer la mémoire');
                    window.location.reload();
                }
            }, 10000);

        } catch (error) {
            console.error('❌ Échec récupération mémoire:', error);
            this.recordError({
                type: 'memory_recovery_failed',
                message: 'Échec récupération mémoire',
                error: error
            });
        }
    }

    // =========================================================================
    // INTERFACE UTILISATEUR
    // =========================================================================

    /**
     * Crée l'interface utilisateur
     */
    createUI() {
        // Charger les styles CSS
        this.loadCSS();

        // Créer le bouton flottant
        this.ui.button = document.createElement('div');
        this.ui.button.id = 'health-monitor-button';
        this.ui.button.innerHTML = '🔍';

        // Créer l'overlay pour le panneau détaillé
        this.ui.overlay = document.createElement('div');
        this.ui.overlay.id = 'health-monitor-overlay';

        // Créer le panneau détaillé
        this.ui.panel = document.createElement('div');
        this.ui.panel.id = 'health-monitor-panel';
        this.ui.panel.innerHTML = this.createPanelHTML();

        // Events
        this.ui.button.addEventListener('click', () => this.toggleDetailedPanel());

        this.ui.overlay.addEventListener('click', () => this.hideDetailedPanel());

        // Events du panneau
        const closeBtn = this.ui.panel.querySelector('.health-panel-close');
        closeBtn?.addEventListener('click', () => this.hideDetailedPanel());

        const refreshBtn = this.ui.panel.querySelector('#health-refresh-btn');
        refreshBtn?.addEventListener('click', () => this.forceRefresh());

        const recoveryBtn = this.ui.panel.querySelector('#health-recovery-btn');
        recoveryBtn?.addEventListener('click', () => this.attemptRecovery());

        const reloadBtn = this.ui.panel.querySelector('#health-reload-btn');
        reloadBtn?.addEventListener('click', () => this.forceReload());

        // Ajouter au DOM
        document.body.appendChild(this.ui.button);
        document.body.appendChild(this.ui.overlay);
        document.body.appendChild(this.ui.panel);

        // Mettre à jour l'apparence initiale
        this.updateButtonAppearance();
    }

    /**
     * Charge les styles CSS
     */
    loadCSS() {
        // Vérifier si les styles sont déjà chargés
        if (document.getElementById('health-monitor-styles')) {
            return;
        }

        // Créer le lien vers le fichier CSS
        const link = document.createElement('link');
        link.id = 'health-monitor-styles';
        link.rel = 'stylesheet';
        link.type = 'text/css';

        // Déterminer le chemin du CSS (même dossier que le script JS)
        const scripts = document.getElementsByTagName('script');
        let cssPath = 'health-monitor.css';

        for (let script of scripts) {
            if (script.src && script.src.includes('health-monitor.js')) {
                cssPath = script.src.replace('.js', '.css');
                break;
            }
        }

        link.href = cssPath;
        document.head.appendChild(link);
    }

    /**
     * Crée le HTML du panneau détaillé - VERSION SÉCURISÉE
     */
    createPanelHTML() {
        return `
            <div class="health-panel-header">
                <h3 class="health-panel-title">🏥 System Health Monitor</h3>
                <button class="health-panel-close">&times;</button>
            </div>
            <div class="health-panel-body">
                <div class="health-metrics-grid" id="health-metrics-grid">
                    <!-- Métriques générées dynamiquement -->
                </div>
                
                <div class="health-info-section">
                    <h4 class="health-info-title">📊 System Information</h4>
                    <div class="health-info-grid" id="health-system-info">
                        <!-- Informations système générées dynamiquement -->
                    </div>
                </div>
                
                <div class="health-info-section">
                    <h4 class="health-info-title">🧠 Memory Details</h4>
                    <div class="health-info-grid" id="health-memory-info">
                        <!-- Informations mémoire générées dynamiquement -->
                    </div>
                </div>
                
                <div class="health-info-section">
                    <h4 class="health-info-title">📝 Recent Activity</h4>
                    <div class="health-history" id="health-activity-log">
                        <!-- Historique généré dynamiquement -->
                    </div>
                </div>
                
                <div class="health-actions">
                    <button class="health-action-btn primary" id="health-refresh-btn">
                        🔄 Refresh Data
                    </button>
                    <button class="health-action-btn secondary" id="health-recovery-btn">
                        🔧 Force Recovery
                    </button>
                    <button class="health-action-btn danger" id="health-reload-btn">
                        ⚡ Reload Page
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Met à jour l'apparence du bouton selon le statut
     */
    updateButtonAppearance() {
        if (!this.ui.button) return;

        // Supprimer toutes les classes de statut
        this.ui.button.classList.remove('healthy', 'warning', 'critical', 'initializing');

        // Ajouter la classe correspondant au statut actuel
        this.ui.button.classList.add(this.state.status);

        const icons = {
            healthy: '✅',
            warning: '⚠️',
            critical: '❌',
            initializing: '🔄'
        };

        this.ui.button.innerHTML = icons[this.state.status];
    }

    /**
     * Affiche/cache le panneau détaillé
     */
    toggleDetailedPanel() {
        if (this.ui.panel.classList.contains('visible')) {
            this.hideDetailedPanel();
        } else {
            this.showDetailedPanel();
        }
    }

    /**
     * Affiche le panneau détaillé
     */
    showDetailedPanel() {
        this.updatePanelContent();
        this.ui.overlay.classList.add('visible');
        this.ui.panel.classList.add('visible');
    }

    /**
     * Cache le panneau détaillé
     */
    hideDetailedPanel() {
        this.ui.overlay.classList.remove('visible');
        this.ui.panel.classList.remove('visible');
    }

    /**
     * Met à jour le contenu du panneau détaillé
     */
    updatePanelContent() {
        this.updateMetricsGrid();
        this.updateSystemInfo();
        this.updateMemoryInfo();
        this.updateActivityLog();
    }

    /**
     * Met à jour la grille des métriques - VERSION SÉCURISÉE
     */
    updateMetricsGrid() {
        const container = this.ui.panel.querySelector('#health-metrics-grid');
        if (!container) return;

        const uptime = this.formatDuration(this.state.uptime);
        const memInfo = this.state.lastMemoryCheck?.data;
        const memUsage = memInfo ? `${memInfo.usagePercent}%` : 'N/A';
        const performanceStatus = this.getPerformanceStatus();

        const metrics = [
            {
                value: this.escapeHtml(`${this.state.healthScore.toFixed(1)}%`),
                label: 'Health Score',
                status: this.state.status,
                subtitle: this.escapeHtml(this.state.status.toUpperCase())
            },
            {
                value: this.escapeHtml(memUsage),
                label: 'Memory Usage',
                status: memInfo?.usagePercent > 80 ? 'critical' : memInfo?.usagePercent > 60 ? 'warning' : 'healthy',
                subtitle: memInfo ? this.escapeHtml(`${memInfo.usedMB}MB / ${memInfo.limitMB}MB`) : 'N/A'
            },
            {
                value: this.escapeHtml(uptime),
                label: 'Uptime',
                status: 'healthy',
                subtitle: this.escapeHtml(new Date(this.state.startTime).toLocaleTimeString())
            },
            {
                value: this.escapeHtml(this.state.refreshCount.toString()),
                label: 'Refreshes',
                status: this.state.systemErrorCount > 0 ? 'warning' : 'healthy',
                subtitle: this.escapeHtml(`${this.state.systemErrorCount} sys / ${this.state.networkErrorCount} net`)
            },
            {
                value: this.escapeHtml(performanceStatus),
                label: 'Performance',
                status: performanceStatus === 'Poor' ? 'critical' : performanceStatus === 'Fair' ? 'warning' : 'healthy',
                subtitle: this.escapeHtml(`${this.metrics.slowOperations} slow ops`)
            },
            {
                value: this.escapeHtml(this.state.recoveryAttempts.toString()),
                label: 'Recoveries',
                status: this.state.recoveryAttempts > 2 ? 'warning' : 'healthy',
                subtitle: this.escapeHtml(`${this.metrics.crashRecoveries} crashes`)
            }
        ];

        container.innerHTML = metrics.map(metric => `
            <div class="health-metric-card ${this.escapeHtml(metric.status)}">
                <div class="health-metric-value">${metric.value}</div>
                <div class="health-metric-label">${this.escapeHtml(metric.label)}</div>
                <div class="health-metric-subtitle">${metric.subtitle}</div>
            </div>
        `).join('');
    }

    /**
     * Met à jour les informations système - VERSION SÉCURISÉE
     */
    updateSystemInfo() {
        const container = this.ui.panel.querySelector('#health-system-info');
        if (!container) return;

        const systemInfo = [
            { label: 'Status', value: this.state.status.toUpperCase() },
            { label: 'Start Time', value: new Date(this.state.startTime).toLocaleString() },
            { label: 'System Errors', value: this.state.systemErrorCount.toString() },
            { label: 'Network Errors', value: this.state.networkErrorCount.toString() },
            { label: 'User Agent', value: navigator.userAgent.split(' ')[0] },
            { label: 'Viewport', value: `${window.innerWidth}×${window.innerHeight}` },
            { label: 'Cross-Origin Isolated', value: window.crossOriginIsolated ? 'Yes' : 'No' },
            { label: 'Memory API', value: this.state.lastMemoryCheck?.data?.api || 'unknown' }
        ];

        container.innerHTML = systemInfo.map(info => `
            <div class="health-info-item">
                <span class="health-info-label">${this.escapeHtml(info.label)}:</span>
                <span class="health-info-value">${this.escapeHtml(String(info.value))}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour les informations mémoire - VERSION SÉCURISÉE
     */
    updateMemoryInfo() {
        const container = this.ui.panel.querySelector('#health-memory-info');
        if (!container) return;

        const memInfo = this.state.lastMemoryCheck?.data;

        if (!memInfo) {
            container.innerHTML = '<div class="health-info-item">No memory data available</div>';
            return;
        }

        const memoryDetails = [
            { label: 'Used Memory', value: `${memInfo.usedMB} MB` },
            { label: 'Memory Limit', value: `${memInfo.limitMB} MB` },
            { label: 'Usage Percentage', value: `${memInfo.usagePercent}%` },
            { label: 'API Type', value: memInfo.api },
            { label: 'Peak Usage', value: `${this.metrics.memoryPeak.toFixed(1)}%` },
            { label: 'Memory Warnings', value: this.state.memoryWarnings.toString() }
        ];

        // Ajouter les détails du breakdown si disponible (API complète)
        if (memInfo.breakdown && memInfo.breakdown.length > 0) {
            memInfo.breakdown.forEach((item, index) => {
                if (index < 4) { // Limiter à 4 entrées pour l'affichage
                    memoryDetails.push({
                        label: item.type,
                        value: `${item.sizeMB} MB`
                    });
                }
            });
        }

        container.innerHTML = memoryDetails.map(info => `
            <div class="health-info-item">
                <span class="health-info-label">${this.escapeHtml(info.label)}:</span>
                <span class="health-info-value">${this.escapeHtml(info.value)}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour le journal d'activité - VERSION SÉCURISÉE
     */
    updateActivityLog() {
        const container = this.ui.panel.querySelector('#health-activity-log');
        if (!container) return;

        const allEvents = [];

        // Ajouter les erreurs récentes
        this.state.errorHistory.slice(-10).forEach(entry => {
            allEvents.push({
                timestamp: entry.timestamp,
                type: 'error',
                message: entry.data.message || 'Unknown error'
            });
        });

        // Ajouter les événements de performance
        this.state.performanceHistory.slice(-5).forEach(entry => {
            if (entry.data.delay > this.config.performanceThreshold) {
                allEvents.push({
                    timestamp: entry.timestamp,
                    type: 'warning',
                    message: `Slow operation: ${entry.data.delay.toFixed(2)}ms`
                });
            }
        });

        // Ajouter les événements de mémoire
        this.state.memoryHistory.slice(-5).forEach(entry => {
            if (entry.data.usagePercent > this.config.memoryThreshold) {
                allEvents.push({
                    timestamp: entry.timestamp,
                    type: 'warning',
                    message: `High memory usage: ${entry.data.usagePercent.toFixed(1)}%`
                });
            }
        });

        // Ajouter des événements système
        if (this.state.recoveryAttempts > 0) {
            allEvents.push({
                timestamp: Date.now(),
                type: 'info',
                message: `Recovery attempts: ${this.state.recoveryAttempts}`
            });
        }

        // Ajouter un résumé des erreurs si pertinent
        if (this.state.networkErrorCount > 0) {
            allEvents.push({
                timestamp: Date.now(),
                type: 'info',
                message: `Network errors: ${this.state.networkErrorCount} (non-critical)`
            });
        }

        // Trier par timestamp (plus récent en premier)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);

        // Limiter à 15 entrées
        const recentEvents = allEvents.slice(0, 15);

        if (recentEvents.length === 0) {
            container.innerHTML = '<div class="health-history-entry info">No recent activity</div>';
            return;
        }

        container.innerHTML = recentEvents.map(event => `
            <div class="health-history-entry ${this.escapeHtml(event.type)}">
                <span class="health-history-time">${this.escapeHtml(new Date(event.timestamp).toLocaleTimeString())}</span>
                <span class="health-history-message">${this.escapeHtml(event.message)}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour l'interface utilisateur
     */
    updateUI() {
        this.updateButtonAppearance();

        // Si le panneau est ouvert, mettre à jour son contenu
        if (this.ui.panel && this.ui.panel.classList.contains('visible')) {
            this.updatePanelContent();
        }
    }

    /**
     * Actions du panneau
     */
    forceRefresh() {
        console.log('🔄 Force refresh triggered by user');
        this.performHealthCheck();
        this.checkMemoryUsage();
        this.updatePanelContent();

        // Notification visuelle
        const btn = this.ui.panel.querySelector('#health-refresh-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Refreshed';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        }
    }

    forceReload() {
        if (confirm('Are you sure you want to reload the page? All unsaved data will be lost.')) {
            console.log('⚡ Force reload triggered by user');
            window.location.reload();
        }
    }

    // =========================================================================
    // UTILITAIRES SÉCURISÉS
    // =========================================================================

    /**
     * Échappe les caractères HTML pour éviter les XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text);
        }

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };

        return text.replace(/[&<>"'\/]/g, (s) => map[s]);
    }

    /**
     * Détermine si une erreur est de type système (critique)
     */
    isSystemError(type) {
        const systemErrorTypes = [
            'javascript',
            'unhandled_promise',
            'resource',
            'health_check',
            'memory_check',
            'performance_check',
            'memory_warning',
            'performance',
            'scale_handler',
            'display_manager',
            'initialization'
        ];
        return systemErrorTypes.includes(type);
    }

    /**
     * Détermine si une erreur est de type réseau (non-critique)
     */
    isNetworkError(type) {
        const networkErrorTypes = [
            'refresh_service',
            'fetch_error',
            'network_timeout',
            'iframe_load_timeout',
            'iframe_error'
        ];
        return networkErrorTypes.includes(type);
    }

    /**
     * Enregistre une erreur - VERSION AVEC DISTINCTION DES TYPES
     */
    recordError(errorInfo) {
        // Nettoyer l'erreur pour éviter les références circulaires
        const cleanError = {
            type: errorInfo.type,
            message: errorInfo.message,
            timestamp: Date.now()
        };

        // Ajouter des détails sécurisés si disponibles
        if (errorInfo.filename) cleanError.filename = errorInfo.filename;
        if (errorInfo.lineno) cleanError.lineno = errorInfo.lineno;
        if (errorInfo.colno) cleanError.colno = errorInfo.colno;
        if (errorInfo.delay) cleanError.delay = errorInfo.delay;

        this.state.lastError = cleanError;

        // Comptabiliser selon le type d'erreur
        if (this.isSystemError(errorInfo.type)) {
            this.state.systemErrorCount++;
            console.error('🔴 Erreur système:', cleanError);
        } else if (this.isNetworkError(errorInfo.type)) {
            this.state.networkErrorCount++;
            console.warn('🟠 Erreur réseau:', cleanError);
        } else {
            // Type d'erreur non classé - traiter comme système par sécurité
            this.state.systemErrorCount++;
            console.error('⚫ Erreur non classée (traitée comme système):', cleanError);
        }

        // Ajouter à l'historique
        this.addToHistory('error', cleanError);

        // Logger selon la configuration
        if (this.config.logLevel === 'error' || this.config.logLevel === 'warn') {
            console.error('❌ HealthMonitor:', cleanError);
        }
    }

    /**
     * Enregistre un refresh
     */
    recordRefresh() {
        this.state.refreshCount++;
    }

    /**
     * Ajoute une entrée à l'historique
     */
    addToHistory(type, data) {
        const entry = {
            timestamp: Date.now(),
            data: data
        };

        const historyKey = `${type}History`;
        const history = this.state[historyKey];

        if (history && Array.isArray(history)) {
            history.push(entry);
            if (history.length > 50) {
                history.shift();
            }
        }
    }

    /**
     * Réduit la taille de l'historique
     */
    trimHistory() {
        ['memoryHistory', 'performanceHistory', 'errorHistory'].forEach(key => {
            if (this.state[key] && this.state[key].length > 20) {
                this.state[key] = this.state[key].slice(-20);
            }
        });
    }

    /**
     * Nettoie les ressources
     */
    cleanupResources() {
        // Vider les historiques anciens
        this.trimHistory();

        // Nettoyer les références potentiellement circulaires
        if (this.state.lastError?.error) {
            delete this.state.lastError.error;
        }

        // Nettoyer les observers
        this.cleanupObservers();
    }

    /**
     * Nettoie les observers de performance
     */
    cleanupObservers() {
        if (this.observers.performance) {
            try {
                this.observers.performance.disconnect();
            } catch (e) {
                console.warn('Erreur lors du cleanup observer:', e);
            }
            this.observers.performance = null;
        }
    }

    /**
     * Formate une durée en texte lisible
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Retourne le statut de performance
     */
    getPerformanceStatus() {
        const recentPerformanceEntries = this.state.performanceHistory.slice(-5);

        if (recentPerformanceEntries.length === 0) {
            return 'Unknown';
        }

        const recentIssues = recentPerformanceEntries.filter(entry =>
            entry.data.hasSlowOperation || entry.data.score === 'poor'
        ).length;

        if (recentIssues === 0) return 'Excellent';
        if (recentIssues <= 1) return 'Good';
        if (recentIssues <= 3) return 'Fair';
        return 'Poor';
    }

    /**
     * Programme le rechargement préventif
     */
    schedulePreventiveReload() {
        this.timers.preventiveReload = setTimeout(() => {
            console.log('🔄 Rechargement préventif programmé');
            window.location.reload();
        }, this.config.preventiveReloadAfter);
    }

    /**
     * Suit les Web Vitals
     */

    trackWebVitals() {
        try {
            if (this.observers.performance) {
                return; // Déjà configuré
            }

            // Observer pour les Long Tasks (vraies opérations lentes)
            this.observers.performance = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'longtask') {
                        // Long Task détectée (>50ms) - avec validation
                        if (entry.duration > 50 && entry.duration < 30000) { // Max 30s
                            this.metrics.slowOperations++;
                            this.recordError({
                                type: 'performance',
                                message: `Long Task détectée: ${entry.duration.toFixed(2)}ms`,
                                duration: entry.duration
                            });
                        }
                    }

                    if (entry.entryType === 'layout-shift' && entry.hadRecentInput === false) {
                        // Layout Shift inattendu - avec validation
                        if (entry.value > 0.1 && entry.value < 5.0) { // Max 5.0
                            this.recordError({
                                type: 'performance',
                                message: `Layout Shift important: ${entry.value.toFixed(3)}`,
                                cls: entry.value
                            });
                        }
                    }

                    if (entry.entryType === 'largest-contentful-paint') {
                        // LCP lent - avec validation stricte
                        if (entry.startTime > 2500 && entry.startTime < 30000) { // Entre 2.5s et 30s
                            this.recordError({
                                type: 'performance',
                                message: `LCP lent: ${entry.startTime.toFixed(2)}ms`,
                                lcp: entry.startTime
                            });
                        } else if (entry.startTime >= 30000) {
                            // Log de debug pour valeurs aberrantes
                            console.debug(`LCP aberrant ignoré: ${entry.startTime}ms`);
                        }
                    }
                }
            });

            // Observer les différents types de métriques de performance
            const entryTypes = ['longtask', 'layout-shift', 'largest-contentful-paint'];

            entryTypes.forEach(type => {
                try {
                    this.observers.performance.observe({ entryTypes: [type] });
                } catch (e) {
                    // Type non supporté dans ce navigateur, ignorer silencieusement
                    console.debug(`Type de métrique non supporté: ${type}`);
                }
            });

        } catch (error) {
            // Silently fail if not supported
            console.warn('Surveillance des Web Vitals non supportée:', error);
        }
    }

    // =========================================================================
    // API PUBLIQUE
    // =========================================================================

    /**
     * Vérifie si le monitoring est actif
     */
    isEnabled() {
        return this.isActive;
    }

    /**
     * Retourne les statistiques complètes
     */
    getStats() {
        return {
            state: { ...this.state },
            metrics: { ...this.metrics },
            config: { ...this.config },
            isActive: this.isActive
        };
    }

    /**
     * Force une vérification de santé
     */
    forceHealthCheck() {
        this.performHealthCheck();
        this.checkMemoryUsage();
    }

    /**
     * Force une tentative de récupération
     */
    forceRecovery() {
        console.log('🔧 Récupération forcée par l\'utilisateur');
        this.attemptRecovery();
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage HealthMonitor');

        this.isActive = false;

        // Arrêter tous les timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });

        // Nettoyer les event listeners
        window.removeEventListener('error', this.boundMethods.handleError);
        window.removeEventListener('unhandledrejection', this.boundMethods.handleRejection);
        window.removeEventListener('error', this.boundMethods.handleResourceError, true);

        // Nettoyer les observers
        this.cleanupObservers();

        // Supprimer l'UI
        if (this.ui.button) this.ui.button.remove();
        if (this.ui.overlay) this.ui.overlay.remove();
        if (this.ui.panel) this.ui.panel.remove();

        // Supprimer les styles CSS
        const styleElement = document.getElementById('health-monitor-styles');
        if (styleElement) styleElement.remove();

        // Nettoyer les références
        this.state = null;
        this.metrics = null;
        this.ui = null;
        this.timers = null;
        this.observers = null;
        this.boundMethods = null;
    }
}

// =============================================================================
// AUTO-INITIALISATION
// =============================================================================

(function () {
    'use strict';

    // Éviter la double initialisation
    if (window.healthMonitor) {
        console.warn('⚠️ HealthMonitor déjà initialisé');
        return;
    }

    // Fonction d'initialisation
    function initHealthMonitor() {
        try {
            window.healthMonitor = new HealthMonitor();
            const success = window.healthMonitor.init();

            if (success) {
                console.log('✅ HealthMonitor auto-initialisé');

                // Exposer des méthodes utiles pour le debug (VERSION SÉCURISÉE)
                window.debug = window.debug || {};
                window.debug.health = {
                    getStats: () => window.healthMonitor.getStats(),
                    getState: () => window.healthMonitor.state,
                    getMetrics: () => window.healthMonitor.metrics,
                    forceHealthCheck: () => window.healthMonitor.forceHealthCheck(),
                    forceRecovery: () => window.healthMonitor.forceRecovery(),
                    cleanup: () => window.healthMonitor.cleanup(),

                    // Helpers pour ThinManager/Shadow
                    showPanel: () => window.healthMonitor.showDetailedPanel(),
                    hidePanel: () => window.healthMonitor.hideDetailedPanel(),
                    isHealthy: () => window.healthMonitor.state.status === 'healthy',
                    getMemoryUsage: () => window.healthMonitor.state.lastMemoryCheck?.data?.usagePercent || 0,
                    getUptime: () => window.healthMonitor.formatDuration(window.healthMonitor.state.uptime)
                };

                console.log('🛠️ Debug: window.debug.health contient les méthodes utiles');

            } else {
                console.error('❌ Échec auto-initialisation HealthMonitor');
            }

        } catch (error) {
            console.error('❌ Erreur auto-initialisation HealthMonitor:', error);
        }
    }

    // Initialiser quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHealthMonitor);
    } else {
        // DOM déjà chargé
        setTimeout(initHealthMonitor, 100);
    }

})();