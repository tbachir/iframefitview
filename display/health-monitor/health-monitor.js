/**
 * Health Monitor - Système de surveillance complet pour HuddleBoard
 * Auto-fonctionnel : suffit d'importer le script
 * Version: 2.0
 */

// =============================================================================
// CONFIGURATION - Modifier ici si nécessaire
// =============================================================================

const HEALTH_CONFIG = {
    // Intervalles (en millisecondes)
    healthCheckInterval: 30000,        // Vérification santé générale
    memoryCheckInterval: 15000,        // Vérification mémoire spécifique
    uiUpdateInterval: 5000,            // Mise à jour interface

    // Seuils d'alerte
    memoryThreshold: 80,               // % mémoire avant alerte
    performanceThreshold: 1000,        // ms pour action considérée lente
    errorThreshold: 5,                 // erreurs consécutives max
    memoryWarningLimit: 3,             // alertes mémoire avant action

    // Auto-récupération
    autoRecover: true,                 // Tentatives auto de récupération
    maxRecoveryAttempts: 3,            // Tentatives max avant abandon
    recoveryDelay: 5000,               // Délai entre tentatives
    preventiveReloadAfter: 12 * 60 * 60 * 1000, // 12h

    // Interface utilisateur
    uiPosition: 'top-right',        // Position du bouton
    showDetailedStats: true,           // Afficher stats détaillées
    logLevel: 'warn',                  // console log level

    // Monitoring avancé
    trackPerformanceMetrics: true,     // Surveiller Web Vitals
    trackNetworkErrors: true,          // Surveiller erreurs réseau
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

            // Compteurs
            refreshCount: 0,
            errorCount: 0,
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

        // Timers
        this.timers = {
            healthCheck: null,
            memoryCheck: null,
            uiUpdate: null,
            preventiveReload: null
        };

        // Éléments UI
        this.ui = {
            button: null,
            tooltip: null,
            overlay: null,
            panel: null,
            isTooltipVisible: false
        };

        // Métriques performance
        this.metrics = {
            memoryPeak: 0,
            slowOperations: 0,
            networkErrors: 0,
            crashRecoveries: 0
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

        console.log('🚀 Initialisation HealthMonitor v2.0');

        try {
            this._setupGlobalErrorHandlers();
            this._createUI();
            this._startMonitoring();
            this._schedulePreventiveReload();

            this.isInitialized = true;
            this.isActive = true;
            this.state.status = 'healthy';

            console.log('✅ HealthMonitor initialisé avec succès');
            return true;

        } catch (error) {
            console.error('❌ Échec initialisation HealthMonitor:', error);
            this.state.status = 'critical';
            return false;
        }
    }

    /**
     * Configure les gestionnaires d'erreurs globaux
     */
    _setupGlobalErrorHandlers() {
        // Erreurs JavaScript
        window.addEventListener('error', (event) => {
            this._recordError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        // Promesses rejetées
        window.addEventListener('unhandledrejection', (event) => {
            this._recordError({
                type: 'unhandled_promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                reason: event.reason
            });
        });

        // Erreurs de ressources (images, scripts, etc.)
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this._recordError({
                    type: 'resource',
                    message: `Failed to load resource: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    url: event.target.src || event.target.href
                });
            }
        }, true);
    }
    // =========================================================================
    // MONITORING CORE
    // =========================================================================

    /**
     * Démarre tous les timers de monitoring
     */
    _startMonitoring() {
        // Vérification santé générale
        this.timers.healthCheck = setInterval(() => {
            this._performHealthCheck();
        }, this.config.healthCheckInterval);

        // Vérification mémoire spécifique
        this.timers.memoryCheck = setInterval(() => {
            this._checkMemoryUsage();
        }, this.config.memoryCheckInterval);

        // Mise à jour interface
        this.timers.uiUpdate = setInterval(() => {
            this._updateUI();
        }, this.config.uiUpdateInterval);

        // Premier check immédiat
        setTimeout(() => {
            this._performHealthCheck();
            this._checkMemoryUsage();
            this._updateUI();
        }, 1000);
    }

    /**
     * Effectue une vérification complète de santé
     */
    _performHealthCheck() {
        if (!this.isActive) return;

        try {
            this.state.uptime = Date.now() - this.state.startTime;

            // Vérifier les performances
            this._checkPerformance();

            // Calculer le score de santé
            this._calculateHealthScore();

            // Détecter les problèmes critiques
            this._detectCriticalIssues();

            // Auto-récupération si nécessaire
            if (this.config.autoRecover && this.state.status === 'critical') {
                this._attemptRecovery();
            }

        } catch (error) {
            this._recordError({
                type: 'health_check',
                message: 'Erreur lors de la vérification de santé',
                error: error
            });
        }
    }

    /**
     * Vérifie l'utilisation mémoire
     */
    async _checkMemoryUsage() {
        try {
            const memoryInfo = await this._getMemoryInfo();
            if (!memoryInfo) return;

            this.state.lastMemoryCheck = {
                timestamp: Date.now(),
                data: memoryInfo
            };

            // Ajouter à l'historique
            this._addToHistory('memory', memoryInfo);

            // Vérifier les seuils
            if (memoryInfo.usagePercent > this.config.memoryThreshold) {
                this.state.memoryWarnings++;
                this._recordError({
                    type: 'memory_warning',
                    message: `Utilisation mémoire élevée: ${memoryInfo.usagePercent.toFixed(1)}%`,
                    data: memoryInfo
                });

                // Action si trop d'alertes
                if (this.state.memoryWarnings > this.config.memoryWarningLimit) {
                    this._triggerMemoryRecovery();
                }
            }

            // Suivre le pic mémoire
            if (memoryInfo.usagePercent > this.metrics.memoryPeak) {
                this.metrics.memoryPeak = memoryInfo.usagePercent;
            }

        } catch (error) {
            this._recordError({
                type: 'memory_check',
                message: 'Erreur lors de la vérification mémoire',
                error: error
            });
        }
    }

    /**
     * Vérifie les performances générales
     */
    _checkPerformance() {
        try {
            const now = performance.now();

            // Mesurer la latence de traitement
            setTimeout(() => {
                const delay = performance.now() - now;

                if (delay > this.config.performanceThreshold) {
                    this.metrics.slowOperations++;
                    this._recordError({
                        type: 'performance',
                        message: `Opération lente détectée: ${delay.toFixed(2)}ms`,
                        delay: delay
                    });
                }

                // Ajouter à l'historique
                this._addToHistory('performance', {
                    timestamp: Date.now(),
                    delay: delay,
                    score: delay < 100 ? 'excellent' : delay < 500 ? 'good' : delay < 1000 ? 'fair' : 'poor'
                });

            }, 0);

            // Vérifier Web Vitals si disponible
            if (this.config.trackPerformanceMetrics && 'PerformanceObserver' in window) {
                this._trackWebVitals();
            }

        } catch (error) {
            this._recordError({
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
    async _getMemoryInfo() {
        // Essayer l'API complète d'abord
        if (window.crossOriginIsolated && performance.measureUserAgentSpecificMemory) {
            try {
                const memoryInfo = await performance.measureUserAgentSpecificMemory();
                return this._parseFullMemoryInfo(memoryInfo);
            } catch (error) {
                console.warn('⚠️ API mémoire complète échouée, fallback vers JS heap');
            }
        }

        // Fallback vers l'API JavaScript
        if (performance.memory) {
            return this._parseJSMemoryInfo();
        }

        return null;
    }

    /**
     * Parse les infos de l'API mémoire complète
     */
    _parseFullMemoryInfo(memoryInfo) {
        const MB = 1024 * 1024;
        let totalBytes = 0;

        memoryInfo.breakdown.forEach(entry => {
            totalBytes += entry.bytes;
        });

        // Estimation de la limite (approximative)
        const estimatedLimit = performance.memory ? performance.memory.jsHeapSizeLimit * 3 : totalBytes * 4;
        const usagePercent = (totalBytes / estimatedLimit) * 100;

        return {
            api: 'full',
            usedMB: Number((totalBytes / MB).toFixed(1)),
            limitMB: Number((estimatedLimit / MB).toFixed(1)),
            usagePercent: Number(usagePercent.toFixed(2)),
            breakdown: memoryInfo.breakdown.map(entry => ({
                type: entry.attribution?.[0]?.scope || 'unknown',
                sizeMB: Number((entry.bytes / MB).toFixed(2))
            }))
        };
    }

    /**
     * Parse les infos de l'API JavaScript
     */
    _parseJSMemoryInfo() {
        const MB = 1024 * 1024;
        const memory = performance.memory;

        const used = memory.usedJSHeapSize;
        const limit = memory.jsHeapSizeLimit;
        const usagePercent = (used / limit) * 100;

        return {
            api: 'js-only',
            usedMB: Number((used / MB).toFixed(1)),
            limitMB: Number((limit / MB).toFixed(1)),
            usagePercent: Number(usagePercent.toFixed(2)),
            totalMB: Number((memory.totalJSHeapSize / MB).toFixed(1))
        };
    }

    // =========================================================================
    // AUTO-RÉCUPÉRATION
    // =========================================================================

    /**
     * Calcule le score de santé global
     */
    _calculateHealthScore() {
        let score = 100;

        // Pénalités basées sur les problèmes
        score -= this.state.errorCount * 2;
        score -= this.state.memoryWarnings * 5;
        score -= this.metrics.slowOperations * 3;
        score -= this.metrics.networkErrors * 1;

        // Bonus pour la stabilité
        const uptimeHours = this.state.uptime / (1000 * 60 * 60);
        if (uptimeHours > 1 && this.state.errorCount === 0) {
            score += Math.min(uptimeHours * 0.5, 10);
        }

        this.state.healthScore = Math.max(0, Math.min(100, score));

        // Déterminer le statut
        if (score >= 90) this.state.status = 'healthy';
        else if (score >= 70) this.state.status = 'warning';
        else this.state.status = 'critical';
    }

    /**
     * Détecte les problèmes critiques
     */
    _detectCriticalIssues() {
        // Trop d'erreurs consécutives
        if (this.state.errorCount >= this.config.errorThreshold) {
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
    }

    /**
     * Tente une récupération automatique
     */
    _attemptRecovery() {
        if (this.state.recoveryAttempts >= this.config.maxRecoveryAttempts) {
            console.error('❌ Nombre maximum de tentatives de récupération atteint');
            return;
        }

        this.state.recoveryAttempts++;
        console.log(`🔄 Tentative de récupération #${this.state.recoveryAttempts}`);

        setTimeout(() => {
            try {
                // Nettoyer les ressources
                this._cleanupResources();

                // Réinitialiser les compteurs
                this.state.errorCount = Math.floor(this.state.errorCount / 2);
                this.state.memoryWarnings = 0;
                this.metrics.slowOperations = 0;

                // Recharger la page si critique
                if (this.state.status === 'critical' && this.state.recoveryAttempts >= 2) {
                    console.log('🔄 Rechargement de la page pour récupération');
                    this.metrics.crashRecoveries++;
                    window.location.reload();
                }

            } catch (error) {
                console.error('❌ Échec de la récupération:', error);
            }
        }, this.config.recoveryDelay);
    }

    /**
     * Déclenche une récupération mémoire
     */
    _triggerMemoryRecovery() {
        console.log('🧹 Tentative de récupération mémoire');

        try {
            // Forcer le garbage collection si possible
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
            }

            // Nettoyer les caches
            this._cleanupResources();

            // Réduire l'historique
            this._trimHistory();

            // Recharger si toujours critique
            setTimeout(() => {
                if (this.state.memoryWarnings > this.config.memoryWarningLimit * 2) {
                    console.log('🔄 Rechargement pour libérer la mémoire');
                    window.location.reload();
                }
            }, 10000);

        } catch (error) {
            console.error('❌ Échec récupération mémoire:', error);
        }
    }

    // =========================================================================
    // INTERFACE UTILISATEUR
    // =========================================================================

    /**
     * Crée l'interface utilisateur
     */
    _createUI() {
        // Charger les styles CSS
        this._loadCSS();

        // Créer le bouton flottant
        this.ui.button = document.createElement('div');
        this.ui.button.id = 'health-monitor-button';
        this.ui.button.innerHTML = '🔍';

        // Créer le tooltip
        this.ui.tooltip = document.createElement('div');
        this.ui.tooltip.id = 'health-monitor-tooltip';

        // Créer l'overlay pour le panneau détaillé
        this.ui.overlay = document.createElement('div');
        this.ui.overlay.id = 'health-monitor-overlay';

        // Créer le panneau détaillé
        this.ui.panel = document.createElement('div');
        this.ui.panel.id = 'health-monitor-panel';
        this.ui.panel.innerHTML = this._createPanelHTML();

        // Events
        this.ui.button.addEventListener('mouseenter', () => this._showTooltip());
        this.ui.button.addEventListener('mouseleave', () => this._hideTooltip());
        this.ui.button.addEventListener('click', () => this._toggleDetailedPanel());

        this.ui.overlay.addEventListener('click', () => this._hideDetailedPanel());

        // Events du panneau
        const closeBtn = this.ui.panel.querySelector('.health-panel-close');
        closeBtn?.addEventListener('click', () => this._hideDetailedPanel());

        const refreshBtn = this.ui.panel.querySelector('#health-refresh-btn');
        refreshBtn?.addEventListener('click', () => this._forceRefresh());

        const recoveryBtn = this.ui.panel.querySelector('#health-recovery-btn');
        recoveryBtn?.addEventListener('click', () => this._attemptRecovery());

        const reloadBtn = this.ui.panel.querySelector('#health-reload-btn');
        reloadBtn?.addEventListener('click', () => this._forceReload());

        // Ajouter au DOM
        document.body.appendChild(this.ui.button);
        document.body.appendChild(this.ui.tooltip);
        document.body.appendChild(this.ui.overlay);
        document.body.appendChild(this.ui.panel);

        // Mettre à jour l'apparence initiale
        this._updateButtonAppearance();
    }

    /**
     * Charge les styles CSS
     */
    _loadCSS() {
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
     * Crée le HTML du panneau détaillé
     */
    _createPanelHTML() {
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
    _updateButtonAppearance() {
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
     * Affiche le tooltip
     */
    _showTooltip() {
        if (!this.ui.tooltip) return;

        this.ui.tooltip.innerHTML = this._generateTooltipContent();
        this.ui.tooltip.classList.add('visible');
        this.ui.isTooltipVisible = true;
    }

    /**
     * Cache le tooltip
     */
    _hideTooltip() {
        if (!this.ui.tooltip || !this.ui.isTooltipVisible) return;

        this.ui.tooltip.classList.remove('visible');
        this.ui.isTooltipVisible = false;
    }

    /**
     * Génère le contenu du tooltip
     */
    _generateTooltipContent() {
        const uptime = this._formatDuration(this.state.uptime);
        const memInfo = this.state.lastMemoryCheck?.data;
        const memText = memInfo ? `${memInfo.usedMB}MB/${memInfo.limitMB}MB (${memInfo.usagePercent}%)` : 'N/A';

        const statusEmoji = {
            healthy: '🟢',
            warning: '🟡',
            critical: '🔴',
            initializing: '🔵'
        };

        return `${statusEmoji[this.state.status]} Health Score: ${this.state.healthScore.toFixed(1)}%
⚡ Memory: ${memText}
🕐 Uptime: ${uptime}
🔄 Refresh: ${this.state.refreshCount} (${this.state.errorCount} err)
📊 Performance: ${this._getPerformanceStatus()}
🧠 API: ${memInfo?.api || 'unknown'}

Click for detailed view`;
    }

    /**
     * Affiche/cache le panneau détaillé
     */
    _toggleDetailedPanel() {
        if (this.ui.panel.classList.contains('visible')) {
            this._hideDetailedPanel();
        } else {
            this._showDetailedPanel();
        }
    }

    /**
     * Affiche le panneau détaillé
     */
    _showDetailedPanel() {
        this._updatePanelContent();
        this.ui.overlay.classList.add('visible');
        this.ui.panel.classList.add('visible');
        this._hideTooltip(); // Cacher le tooltip quand le panneau s'ouvre
    }

    /**
     * Cache le panneau détaillé
     */
    _hideDetailedPanel() {
        this.ui.overlay.classList.remove('visible');
        this.ui.panel.classList.remove('visible');
    }

    /**
     * Met à jour le contenu du panneau détaillé
     */
    _updatePanelContent() {
        this._updateMetricsGrid();
        this._updateSystemInfo();
        this._updateMemoryInfo();
        this._updateActivityLog();
    }

    /**
     * Met à jour la grille des métriques
     */
    _updateMetricsGrid() {
        const container = this.ui.panel.querySelector('#health-metrics-grid');
        if (!container) return;

        const uptime = this._formatDuration(this.state.uptime);
        const memInfo = this.state.lastMemoryCheck?.data;
        const memUsage = memInfo ? `${memInfo.usagePercent}%` : 'N/A';
        const performanceStatus = this._getPerformanceStatus();

        const metrics = [
            {
                value: `${this.state.healthScore.toFixed(1)}%`,
                label: 'Health Score',
                status: this.state.status,
                subtitle: this.state.status.toUpperCase()
            },
            {
                value: memUsage,
                label: 'Memory Usage',
                status: memInfo?.usagePercent > 80 ? 'critical' : memInfo?.usagePercent > 60 ? 'warning' : 'healthy',
                subtitle: memInfo ? `${memInfo.usedMB}MB / ${memInfo.limitMB}MB` : 'N/A'
            },
            {
                value: uptime,
                label: 'Uptime',
                status: 'healthy',
                subtitle: new Date(this.state.startTime).toLocaleTimeString()
            },
            {
                value: this.state.refreshCount.toString(),
                label: 'Refreshes',
                status: this.state.errorCount > 0 ? 'warning' : 'healthy',
                subtitle: `${this.state.errorCount} errors`
            },
            {
                value: performanceStatus,
                label: 'Performance',
                status: performanceStatus === 'Poor' ? 'critical' : performanceStatus === 'Fair' ? 'warning' : 'healthy',
                subtitle: `${this.metrics.slowOperations} slow ops`
            },
            {
                value: this.state.recoveryAttempts.toString(),
                label: 'Recoveries',
                status: this.state.recoveryAttempts > 2 ? 'warning' : 'healthy',
                subtitle: `${this.metrics.crashRecoveries} crashes`
            }
        ];

        container.innerHTML = metrics.map(metric => `
            <div class="health-metric-card ${metric.status}">
                <div class="health-metric-value">${metric.value}</div>
                <div class="health-metric-label">${metric.label}</div>
                <div class="health-metric-subtitle">${metric.subtitle}</div>
            </div>
        `).join('');
    }

    /**
     * Met à jour les informations système
     */
    _updateSystemInfo() {
        const container = this.ui.panel.querySelector('#health-system-info');
        if (!container) return;

        const systemInfo = [
            { label: 'Status', value: this.state.status.toUpperCase() },
            { label: 'Start Time', value: new Date(this.state.startTime).toLocaleString() },
            { label: 'User Agent', value: navigator.userAgent.split(' ')[0] },
            { label: 'Viewport', value: `${window.innerWidth}×${window.innerHeight}` },
            { label: 'Cross-Origin Isolated', value: window.crossOriginIsolated ? 'Yes' : 'No' },
            { label: 'Memory API', value: this.state.lastMemoryCheck?.data?.api || 'unknown' },
            { label: 'Network Type', value: navigator.connection?.effectiveType || 'unknown' },
            { label: 'CPU Cores', value: navigator.hardwareConcurrency || 'unknown' }
        ];

        container.innerHTML = systemInfo.map(info => `
            <div class="health-info-item">
                <span class="health-info-label">${info.label}:</span>
                <span class="health-info-value">${info.value}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour les informations mémoire
     */
    _updateMemoryInfo() {
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
                        label: `${item.type}`,
                        value: `${item.sizeMB} MB`
                    });
                }
            });
        }

        container.innerHTML = memoryDetails.map(info => `
            <div class="health-info-item">
                <span class="health-info-label">${info.label}:</span>
                <span class="health-info-value">${info.value}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour le journal d'activité
     */
    _updateActivityLog() {
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
                message: `System recovery attempts: ${this.state.recoveryAttempts}`
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
            <div class="health-history-entry ${event.type}">
                <span class="health-history-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                <span class="health-history-message">${event.message}</span>
            </div>
        `).join('');
    }

    /**
     * Met à jour l'interface utilisateur
     */
    _updateUI() {
        this._updateButtonAppearance();

        if (this.ui.isTooltipVisible) {
            this._showTooltip(); // Refresh content
        }

        // Si le panneau est ouvert, mettre à jour son contenu
        if (this.ui.panel && this.ui.panel.classList.contains('visible')) {
            this._updatePanelContent();
        }
    }

    /**
     * Actions du panneau
     */
    _forceRefresh() {
        console.log('🔄 Force refresh triggered by user');
        this._performHealthCheck();
        this._checkMemoryUsage();
        this._updatePanelContent();

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

    _forceReload() {
        if (confirm('Are you sure you want to reload the page? All unsaved data will be lost.')) {
            console.log('⚡ Force reload triggered by user');
            window.location.reload();
        }
    }

    // =========================================================================
    // UTILITAIRES
    // =========================================================================

    /**
     * Enregistre une erreur
     */
    _recordError(errorInfo) {
        this.state.errorCount++;
        this.state.lastError = {
            ...errorInfo,
            timestamp: Date.now()
        };

        // Ajouter à l'historique
        this._addToHistory('error', errorInfo);

        // Logger selon la configuration
        if (this.config.logLevel === 'error' || this.config.logLevel === 'warn') {
            console.error('❌ HealthMonitor:', errorInfo);
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
    _addToHistory(type, data) {
        const entry = {
            timestamp: Date.now(),
            data: data
        };

        const history = this.state[`${type}History`];
        if (history) {
            history.push(entry);
            if (history.length > 50) {
                history.shift();
            }
        }
    }

    /**
     * Réduit la taille de l'historique
     */
    _trimHistory() {
        ['memoryHistory', 'performanceHistory', 'errorHistory'].forEach(key => {
            if (this.state[key].length > 20) {
                this.state[key] = this.state[key].slice(-20);
            }
        });
    }

    /**
     * Nettoie les ressources
     */
    _cleanupResources() {
        // Vider les historiques anciens
        this._trimHistory();

        // Nettoyer les références potentiellement circulaires
        if (this.state.lastError?.error) {
            delete this.state.lastError.error;
        }
    }

    /**
     * Formate une durée en texte lisible
     */
    _formatDuration(ms) {
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
    _getPerformanceStatus() {
        if (this.metrics.slowOperations === 0) return 'Excellent';
        if (this.metrics.slowOperations < 3) return 'Good';
        if (this.metrics.slowOperations < 10) return 'Fair';
        return 'Poor';
    }

    /**
     * Programme le rechargement préventif
     */
    _schedulePreventiveReload() {
        this.timers.preventiveReload = setTimeout(() => {
            console.log('🔄 Rechargement préventif programmé');
            window.location.reload();
        }, this.config.preventiveReloadAfter);
    }

    /**
     * Suit les Web Vitals
     */
    _trackWebVitals() {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure' && entry.duration > this.config.performanceThreshold) {
                        this.metrics.slowOperations++;
                    }
                }
            });
            observer.observe({ entryTypes: ['measure'] });
        } catch (error) {
            // Silently fail if not supported
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
        this._performHealthCheck();
        this._checkMemoryUsage();
    }

    /**
     * Force une tentative de récupération
     */
    forceRecovery() {
        console.log('🔧 Récupération forcée par l\'utilisateur');
        this._attemptRecovery();
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuration HealthMonitor mise à jour');
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage HealthMonitor');

        this.isActive = false;

        // Arrêter tous les timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });

        // Supprimer l'UI
        if (this.ui.button) this.ui.button.remove();
        if (this.ui.tooltip) this.ui.tooltip.remove();
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
    }

    /**
     * Redémarre le monitoring
     */
    restart() {
        console.log('🔄 Redémarrage HealthMonitor');
        this.cleanup();

        // Réinitialiser les propriétés
        this.isInitialized = false;
        this.isActive = false;

        // Reconstruire l'état initial
        this.state = {
            startTime: Date.now(),
            uptime: 0,
            healthScore: 100,
            status: 'initializing',
            refreshCount: 0,
            errorCount: 0,
            recoveryAttempts: 0,
            memoryWarnings: 0,
            lastError: null,
            lastMemoryCheck: null,
            lastPerformanceCheck: null,
            memoryHistory: [],
            performanceHistory: [],
            errorHistory: []
        };

        this.metrics = {
            memoryPeak: 0,
            slowOperations: 0,
            networkErrors: 0,
            crashRecoveries: 0
        };

        this.timers = {
            healthCheck: null,
            memoryCheck: null,
            uiUpdate: null,
            preventiveReload: null
        };

        this.ui = {
            button: null,
            tooltip: null,
            overlay: null,
            panel: null,
            isTooltipVisible: false
        };

        // Redémarrer
        setTimeout(() => this.init(), 100);
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

                // Exposer des méthodes utiles pour le debug
                window.debug = window.debug || {};
                window.debug.health = {
                    getStats: () => window.healthMonitor.getStats(),
                    getState: () => window.healthMonitor.state,
                    getMetrics: () => window.healthMonitor.metrics,
                    forceHealthCheck: () => window.healthMonitor.forceHealthCheck(),
                    forceRecovery: () => window.healthMonitor.forceRecovery(),
                    updateConfig: (config) => window.healthMonitor.updateConfig(config),
                    restart: () => window.healthMonitor.restart(),
                    cleanup: () => window.healthMonitor.cleanup(),

                    // Helpers pour ThinManager/Shadow
                    showPanel: () => window.healthMonitor._showDetailedPanel(),
                    hidePanel: () => window.healthMonitor._hideDetailedPanel(),
                    isHealthy: () => window.healthMonitor.state.status === 'healthy',
                    getMemoryUsage: () => window.healthMonitor.state.lastMemoryCheck?.data?.usagePercent || 0,
                    getUptime: () => window.healthMonitor._formatDuration(window.healthMonitor.state.uptime)
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