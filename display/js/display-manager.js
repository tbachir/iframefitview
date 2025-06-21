/**
 * Display Manager - Gestionnaire d'affichage pour HuddleBoard
 * Gère le rendu et le cycle de vie des displays
 * Version 2.1 - Corrections critiques et gestion d'erreurs améliorée
 */
class DisplayManager {
    constructor(display) {
        this.display = display;
        this.iframe = null;
        this.scaleHandler = null;
        this.refreshService = null;
        this.loadTimeout = null;
        this.isDestroyed = false;

        // Configuration du timeout de chargement
        this.config = {
            loadTimeoutDuration: 30000, // 30 secondes
            errorRetryDelay: 5000,      // 5 secondes avant retry
            maxRetryAttempts: 3         // 3 tentatives max
        };

        this.retryCount = 0;

        // Bind methods pour éviter les problèmes de contexte
        this.boundOnLoad = this.onIframeLoad.bind(this);
        this.boundOnError = this.onIframeError.bind(this);
    }

    /**
     * Effectue le rendu du display
     */
    render() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager détruit, impossible de rendre');
            return;
        }

        try {
            this.createHTML();
            this.setupIframe();
            this.initializeServices();
        } catch (error) {
            console.error('❌ Erreur lors du rendu:', error);
            this.recordError('render_error', error);
        }
    }

    /**
     * Crée la structure HTML du display
     */
    createHTML() {
        const appElement = document.getElementById('app');
        if (!appElement) {
            throw new Error('Élément #app non trouvé dans le DOM');
        }

        // Échapper les données pour éviter les XSS
        const displayName = this.escapeHtml(this.display.name || 'Display');
        const displayPath = this.escapeHtml(this.display.path || '');

        appElement.innerHTML = `
            <div class="display-header">
                <a href="../" class="back-button">←</a>
                <h3 style="margin: 0;">${displayName}</h3>
            </div>
            <div class="iframe-container">
                <iframe src="${displayPath}" id="display-iframe"></iframe>
            </div>
        `;

        this.iframe = document.getElementById('display-iframe');
        
        if (!this.iframe) {
            throw new Error('Impossible de créer l\'iframe');
        }
    }

    /**
     * Configure l'iframe et ses gestionnaires d'événements
     */
    setupIframe() {
        if (!this.iframe || this.isDestroyed) return;

        // Configurer les gestionnaires d'événements
        this.iframe.addEventListener('load', this.boundOnLoad);
        this.iframe.addEventListener('error', this.boundOnError);

        // Démarrer le timeout de chargement si monitoring activé
        if (this.isMonitoringEnabled()) {
            this.startLoadTimeout();
        }
    }

    /**
     * Vérifie si le monitoring est activé
     */
    isMonitoringEnabled() {
        return window.healthMonitor && 
               typeof window.healthMonitor.isEnabled === 'function' && 
               window.healthMonitor.isEnabled();
    }

    /**
     * Démarre le timeout de chargement
     */
    startLoadTimeout() {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
        }

        this.loadTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
                console.error('⏱️ Timeout chargement iframe');
                this.recordError('iframe_load_timeout', new Error('Timeout de chargement iframe'));
                this.handleLoadTimeout();
            }
        }, this.config.loadTimeoutDuration);
    }

    /**
     * Gestionnaire de chargement de l'iframe
     */
    onIframeLoad() {
        if (this.isDestroyed) return;

        console.log('✅ Iframe chargée avec succès');

        // Nettoyer le timeout
        this.clearLoadTimeout();

        // Réinitialiser le compteur de retry
        this.retryCount = 0;

        // Enregistrer le succès dans le monitoring
        if (this.isMonitoringEnabled()) {
            this.recordSuccess('iframe_loaded');
        }
    }

    /**
     * Gestionnaire d'erreur de l'iframe
     */
    onIframeError(event) {
        if (this.isDestroyed) return;

        console.error('❌ Erreur iframe:', event);

        // Nettoyer le timeout
        this.clearLoadTimeout();

        // Enregistrer l'erreur
        this.recordError('iframe_error', new Error('Erreur de chargement iframe'));

        // Programmer un retry si possible
        this.scheduleRetry();
    }

    /**
     * Gère le timeout de chargement
     */
    handleLoadTimeout() {
        console.log('🔄 Gestion du timeout de chargement');
        this.scheduleRetry();
    }

    /**
     * Programme un retry de chargement
     */
    scheduleRetry() {
        if (this.isDestroyed) return;

        this.retryCount++;

        if (this.retryCount <= this.config.maxRetryAttempts) {
            console.log(`🔄 Tentative de rechargement ${this.retryCount}/${this.config.maxRetryAttempts} dans ${this.config.errorRetryDelay}ms`);
            
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.reloadIframe();
                }
            }, this.config.errorRetryDelay);
        } else {
            console.error('❌ Nombre maximum de tentatives de rechargement atteint');
            this.recordError('iframe_max_retries', new Error('Nombre maximum de tentatives atteint'));
        }
    }

    /**
     * Nettoie le timeout de chargement
     */
    clearLoadTimeout() {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
    }

    /**
     * Initialise les services associés
     */
    initializeServices() {
        if (this.isDestroyed || !this.iframe) return;

        try {
            // Initialiser le gestionnaire de mise à l'échelle
            this.scaleHandler = new ScaleHandler(this.iframe);

            // Initialiser le service de refresh seulement si le monitoring est désactivé pour ce display
            // ou si le monitoring global n'existe pas
            if (this.shouldEnableRefresh()) {
                this.refreshService = new RefreshService(this.display, this.iframe);
            } else {
                console.log('📴 Service de refresh désactivé pour ce display');
            }

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation des services:', error);
            this.recordError('services_init_error', error);
        }
    }

    /**
     * Détermine si le service de refresh doit être activé
     */
    shouldEnableRefresh() {
        // Vérifier la configuration du display
        if (this.display.monitoring === false) {
            return false;
        }

        // Vérifier la configuration globale
        if (window.AppConfig && window.AppConfig.monitoring === false) {
            return false;
        }

        return true;
    }

    /**
     * Recharge l'iframe
     */
    reloadIframe() {
        if (!this.iframe || this.isDestroyed) return;

        console.log('🔄 Rechargement iframe...');

        try {
            // Démarrer le timeout pour le nouveau chargement
            if (this.isMonitoringEnabled()) {
                this.startLoadTimeout();
            }

            const currentSrc = this.iframe.src;
            this.iframe.src = 'about:blank';
            
            setTimeout(() => {
                if (!this.isDestroyed && this.iframe) {
                    this.iframe.src = currentSrc;
                }
            }, 100);

        } catch (error) {
            console.error('❌ Erreur lors du rechargement iframe:', error);
            this.recordError('iframe_reload_error', error);
        }
    }

    /**
     * Vérifie si l'iframe est accessible
     */
    isIframeAccessible() {
        if (!this.iframe || this.isDestroyed) return false;

        try {
            return this.iframe.contentDocument !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * Récupère les informations du display
     */
    getDisplayInfo() {
        if (this.isDestroyed) {
            return {
                isDestroyed: true,
                name: null,
                slug: null,
                path: null,
                refreshInterval: null,
                monitoring: null,
                isLoaded: false
            };
        }

        return {
            name: this.display.name,
            slug: this.display.slug,
            path: this.display.path,
            refreshInterval: this.display.refreshInterval,
            monitoring: this.display.monitoring,
            isLoaded: this.isIframeAccessible(),
            retryCount: this.retryCount,
            hasTimeout: this.loadTimeout !== null,
            isDestroyed: this.isDestroyed
        };
    }

    /**
     * Force un refresh du contenu
     */
    forceRefresh() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager détruit, impossible de forcer le refresh');
            return;
        }

        if (this.refreshService && typeof this.refreshService.forceRefresh === 'function') {
            this.refreshService.forceRefresh();
        } else {
            // Fallback: recharger l'iframe
            this.reloadIframe();
        }
    }

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
     * Enregistre une erreur dans le monitoring (sécurisé)
     */
    recordError(type, error) {
        if (window.healthMonitor && typeof window.healthMonitor.recordError === 'function') {
            try {
                window.healthMonitor.recordError({
                    type: type,
                    message: error?.message || 'Erreur inconnue du gestionnaire d\'affichage',
                    source: 'DisplayManager',
                    displaySlug: this.display?.slug || 'unknown'
                });
            } catch (e) {
                console.warn('Erreur lors de l\'enregistrement dans healthMonitor:', e);
            }
        }
    }

    /**
     * Enregistre un succès dans le monitoring (sécurisé)
     */
    recordSuccess(type) {
        if (window.healthMonitor && typeof window.healthMonitor.recordRefresh === 'function') {
            try {
                // Utiliser recordRefresh comme indicateur de succès général
                window.healthMonitor.recordRefresh();
            } catch (error) {
                console.warn('Erreur lors de l\'enregistrement du succès:', error);
            }
        }
    }

    /**
     * Met à jour la configuration du manager
     */
    updateConfig(newConfig) {
        if (this.isDestroyed) return;

        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuration DisplayManager mise à jour:', newConfig);
    }

    /**
     * Vérifie l'intégrité du manager
     */
    checkIntegrity() {
        const issues = [];

        if (this.isDestroyed) {
            issues.push('Manager marqué comme détruit');
        }

        if (!this.display) {
            issues.push('Configuration display manquante');
        }

        if (!this.iframe && !this.isDestroyed) {
            issues.push('Iframe manquante alors que le manager est actif');
        }

        if (this.loadTimeout && this.isDestroyed) {
            issues.push('Timeout actif alors que le manager est détruit');
        }

        if (this.retryCount > this.config.maxRetryAttempts) {
            issues.push(`Trop de tentatives: ${this.retryCount}`);
        }

        if (issues.length > 0) {
            console.warn('⚠️ Problèmes d\'intégrité DisplayManager:', issues);
            return false;
        }

        return true;
    }

    /**
     * Nettoie les ressources - VERSION AMÉLIORÉE
     */
    async cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage DisplayManager');

        // Marquer comme détruit
        this.isDestroyed = true;

        // Nettoyer le timeout
        this.clearLoadTimeout();

        // Nettoyer les event listeners de l'iframe
        if (this.iframe) {
            try {
                this.iframe.removeEventListener('load', this.boundOnLoad);
                this.iframe.removeEventListener('error', this.boundOnError);
            } catch (error) {
                console.warn('Erreur lors du nettoyage des listeners iframe:', error);
            }
        }

        // Nettoyer les services
        const cleanupPromises = [];

        if (this.scaleHandler && typeof this.scaleHandler.cleanup === 'function') {
            try {
                this.scaleHandler.cleanup();
            } catch (error) {
                console.warn('Erreur lors du nettoyage ScaleHandler:', error);
            }
        }

        if (this.refreshService && typeof this.refreshService.cleanup === 'function') {
            try {
                // RefreshService.cleanup() retourne une Promise
                cleanupPromises.push(this.refreshService.cleanup());
            } catch (error) {
                console.warn('Erreur lors du nettoyage RefreshService:', error);
            }
        }

        // Attendre que tous les cleanups asynchrones se terminent
        if (cleanupPromises.length > 0) {
            try {
                await Promise.allSettled(cleanupPromises);
            } catch (error) {
                console.warn('Erreur lors du cleanup asynchrone:', error);
            }
        }

        // Nettoyer les références
        this.scaleHandler = null;
        this.refreshService = null;
        this.iframe = null;
        this.display = null;
        this.boundOnLoad = null;
        this.boundOnError = null;
        this.retryCount = 0;
        this.config = null;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayManager;
}