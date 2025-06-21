/**
 * Refresh Service - Service de rafraîchissement automatique
 * Surveille les changements de contenu et recharge si nécessaire
 * Version 2.1 - Corrections race conditions et memory leaks
 */
class RefreshService {
    constructor(display, iframe) {
        this.display = display;
        this.iframe = iframe;
        this.interval = display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000;
        this.timer = null;
        this.lastHash = null;
        this.isRefreshing = false;
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        this.isDestroyed = false;

        // Gestion sécurisée des AbortController
        this.currentRequest = null;
        this.requestQueue = new Set();

        this.config = {
            maxRetries: 3,
            retryDelay: 5000,
            timeoutDuration: 10000,
            maxConsecutiveErrors: 5,
            slowdownMultiplier: 2,
            maxInterval: 300000, // 5 minutes max
            minInterval: 5000    // 5 secondes min
        };

        // Bind methods pour éviter les problèmes de contexte
        this.boundRefresh = this.refresh.bind(this);
        this.boundRetry = this.handleRetry.bind(this);

        this.start();
    }

    /**
     * Démarre le service de refresh
     */
    start() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService détruit, impossible de démarrer');
            return;
        }

        console.log(`🔄 Service de refresh démarré (intervalle: ${this.interval}ms)`);
        this.refresh();
        this.scheduleNext();
    }

    /**
     * Programme le prochain refresh
     */
    scheduleNext() {
        if (this.isDestroyed) return;

        // Nettoyer le timer existant
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.timer = setInterval(this.boundRefresh, this.interval);
    }

    /**
     * Effectue un refresh du contenu - VERSION THREAD-SAFE
     */
    async refresh() {
        // Vérifications de sécurité
        if (this.isDestroyed) {
            console.log('🚫 RefreshService détruit, arrêt du refresh');
            return;
        }

        if (this.isRefreshing) {
            console.log('⏭️ Refresh déjà en cours, ignoré');
            return;
        }

        // Lock atomique
        this.isRefreshing = true;

        try {
            await this.performRefresh();
        } catch (error) {
            console.error('❌ Erreur inattendue dans refresh:', error);
            this.handleFailedRefresh(error);
        } finally {
            // Unlock atomique
            this.isRefreshing = false;
        }
    }

    /**
     * Effectue le refresh proprement dit
     */
    async performRefresh() {
        // Annuler la requête précédente si elle existe
        await this.cancelCurrentRequest();

        // Créer une nouvelle requête
        const request = this.createRequest();
        this.currentRequest = request;
        this.requestQueue.add(request);

        try {
            const result = await this.fetchContentWithRequest(request);

            // Vérifier si la requête n'a pas été annulée entre temps
            if (request.signal.aborted || this.isDestroyed) {
                console.log('🚫 Requête annulée ou service détruit');
                return;
            }

            if (result.success) {
                this.handleSuccessfulRefresh(result);
            } else {
                this.handleFailedRefresh(result.error);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('🚫 Requête annulée');
            } else {
                this.handleFailedRefresh(error);
            }
        } finally {
            // Nettoyer la requête de la queue
            this.requestQueue.delete(request);
            if (this.currentRequest === request) {
                this.currentRequest = null;
            }
        }
    }

    /**
     * Annule la requête courante de façon sécurisée
     */
    async cancelCurrentRequest() {
        if (this.currentRequest) {
            try {
                this.currentRequest.controller.abort();

                // Attendre un tick pour s'assurer que l'annulation est traitée
                await new Promise(resolve => setTimeout(resolve, 0));

            } catch (error) {
                console.warn('Erreur lors de l\'annulation de requête:', error);
            }
        }
    }

    /**
     * Crée un objet de requête avec contrôleur
     */
    createRequest() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, this.config.timeoutDuration);

        return {
            controller,
            signal: controller.signal,
            timeoutId,
            timestamp: Date.now()
        };
    }

    /**
     * Récupère le contenu distant avec une requête spécifique
     */
    async fetchContentWithRequest(request) {
        try {
            const preloadUrl = this.buildUrl();
            const now = new Date();

            console.log(`📡 Vérification de ${preloadUrl}`);

            const response = await fetch(preloadUrl, {
                method: 'GET',
                cache: 'no-cache',
                signal: request.signal,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            // Nettoyer le timeout
            clearTimeout(request.timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const newContent = await response.text();

            return {
                success: true,
                content: newContent,
                timestamp: now,
                url: preloadUrl
            };

        } catch (error) {
            // Nettoyer le timeout en cas d'erreur
            clearTimeout(request.timeoutId);

            if (error.name === 'AbortError') {
                return { success: false, error: 'Request aborted' };
            }

            return { success: false, error: error };
        }
    }

    /**
     * Gère un refresh réussi
     */
    handleSuccessfulRefresh(result) {
        if (this.isDestroyed) return;

        const { content, timestamp, url } = result;

        // Réinitialiser les compteurs d'erreur
        this.consecutiveErrors = 0;
        this.retryCount = 0;

        // Afficher le statut de succès
        this.showStatusBanner(timestamp, true);

        // Vérifier si le contenu a changé
        if (content && this.hasContentChanged(content)) {
            console.log('📄 Contenu modifié détecté, rechargement...');
            this.reloadIframe(url);

            // Sauvegarder et afficher la modification
            try {
                localStorage.setItem('hb_sync', timestamp.getTime());
            } catch (e) {
                console.warn('Impossible de sauvegarder la date de sync:', e);
            }

            this.showModifBanner(timestamp);
        }

        // Enregistrer le refresh dans le monitoring
        this.recordRefresh();

        // Accélérer si on était ralenti
        if (this.interval > (this.display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000)) {
            this.speedUp();
        }
    }

    /**
     * Gère un refresh échoué
     */
    handleFailedRefresh(error) {
        if (this.isDestroyed) return;

        this.consecutiveErrors++;
        this.retryCount++;

        console.error(`❌ Erreur refresh (tentative ${this.retryCount}/${this.config.maxRetries}):`, error);

        // Utiliser la nouvelle banner de statut avec compteur d'erreurs
        this.showStatusBanner(undefined, false, this.consecutiveErrors);

        // Enregistrer l'erreur dans le monitoring
        this.recordError(error);

        // Ralentir si trop d'erreurs
        if (this.shouldSlowDown(this.consecutiveErrors)) {
            console.log('⚠️ Trop d\'erreurs, ralentissement du refresh');
            this.slowDown();
        }

        // Programmer un retry si nécessaire
        if (this.retryCount < this.config.maxRetries) {
            this.scheduleRetry();
        } else {
            this.retryCount = 0;
        }
    }

    /**
     * Programme un retry de façon sécurisée
     */
    scheduleRetry() {
        if (this.isDestroyed) return;

        console.log(`🔄 Nouvelle tentative dans ${this.config.retryDelay}ms`);

        setTimeout(this.boundRetry, this.config.retryDelay);
    }

    /**
     * Gestionnaire de retry
     */
    handleRetry() {
        if (!this.isDestroyed && !this.isRefreshing) {
            this.refresh();
        }
    }

    /**
     * Détermine si le système doit ralentir
     */
    shouldSlowDown(consecutiveErrors) {
        return consecutiveErrors >= this.config.maxConsecutiveErrors;
    }

    /**
     * Vérifie si le contenu a changé
     */
    hasContentChanged(newContent) {
        if (!newContent) return false;

        const newHash = this.calculateHash(newContent);

        if (!this.lastHash) {
            this.lastHash = newHash;
            return false; // Premier chargement
        }

        const hasChanged = newHash !== this.lastHash;

        if (hasChanged) {
            console.log(`🔍 Hash changé: ${this.lastHash} → ${newHash}`);
            this.lastHash = newHash;
        }

        return hasChanged;
    }

    /**
     * Calcule un hash du contenu
     */
    calculateHash(text) {
        if (typeof text !== 'string') return '0';
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
        }
        return (hash >>> 0).toString(16);
    }

    /**
     * Recharge l'iframe avec la nouvelle URL
     */
    reloadIframe(url) {
        if (this.iframe && !this.isDestroyed) {
            console.log('🔄 Rechargement iframe avec nouveau contenu');
            this.iframe.src = url || this.buildUrl();
        }
    }

    /**
     * Ralentit l'intervalle de refresh
     */
    slowDown() {
        const oldInterval = this.interval;
        this.interval = Math.min(
            this.interval * this.config.slowdownMultiplier,
            this.config.maxInterval
        );

        if (this.interval !== oldInterval) {
            console.log(`🐌 Ralentissement: ${oldInterval}ms → ${this.interval}ms`);
            this.scheduleNext();
        }
    }

    /**
     * Accélère l'intervalle de refresh (après récupération)
     */
    speedUp() {
        const originalInterval = this.display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000;
        const oldInterval = this.interval;

        this.interval = Math.max(originalInterval, this.config.minInterval);

        if (this.interval !== oldInterval) {
            console.log(`🚀 Accélération: ${oldInterval}ms → ${this.interval}ms`);
            this.scheduleNext();
        }
    }

    /**
     * Construit l'URL avec cache-busting
     */
    buildUrl() {
        const base = this.display.path;
        const separator = base.includes('?') ? '&' : '?';
        const timestamp = Date.now();
        return `${base}${separator}t=${timestamp}&r=${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Force un refresh immédiat
     */
    forceRefresh() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService détruit, impossible de forcer le refresh');
            return;
        }

        console.log('🔄 Refresh forcé');
        this.lastHash = null; // Force la détection de changement
        this.consecutiveErrors = 0;
        this.retryCount = 0;

        // Annuler le timer actuel et rafraîchir immédiatement
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.refresh().then(() => {
            if (!this.isDestroyed) {
                this.scheduleNext();
            }
        });
    }

    /**
     * Pause le service de refresh
     */
    pause() {
        if (this.isDestroyed) return;

        console.log('⏸️ Service de refresh mis en pause');

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.cancelAllRequests();
    }

    /**
     * Reprend le service de refresh
     */
    resume() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService détruit, impossible de reprendre');
            return;
        }

        console.log('▶️ Service de refresh repris');

        if (!this.timer) {
            this.scheduleNext();
        }
    }

    /**
     * Met à jour l'intervalle de refresh
     */
    updateInterval(newInterval) {
        if (this.isDestroyed) return;

        const oldInterval = this.interval;
        this.interval = Math.max(newInterval, this.config.minInterval);

        console.log(`⏱️ Intervalle mis à jour: ${oldInterval}ms → ${this.interval}ms`);

        if (this.timer) {
            this.scheduleNext();
        }
    }

    /**
     * Récupère les statistiques du service
     */
    getStats() {
        return {
            interval: this.interval,
            consecutiveErrors: this.consecutiveErrors,
            retryCount: this.retryCount,
            isRefreshing: this.isRefreshing,
            lastHash: this.lastHash,
            isActive: this.timer !== null,
            isDestroyed: this.isDestroyed,
            activeRequests: this.requestQueue.size
        };
    }

    /**
     * Vérifie si le service est actif
     */
    isActive() {
        return this.timer !== null && !this.isDestroyed;
    }

    /**
     * Vérifie si une requête est en cours
     */
    isBusy() {
        return this.isRefreshing;
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuration refresh mise à jour:', newConfig);
    }

    // =========================================================================
    // INTÉGRATION AVEC LE SYSTÈME DE BANNERS (méthodes sécurisées)
    // =========================================================================

    /**
     * Affiche le banner de statut (sécurisé)
     */
    showStatusBanner(date, ok = true, errorCount = 0) {
        if (typeof window.showStatusBanner === 'function') {
            try {
                window.showStatusBanner(date, ok, errorCount);
            } catch (error) {
                console.warn('Erreur lors de l\'affichage du status banner:', error);
            }
        }
    }

    /**
     * Affiche le banner de modification (sécurisé)
     */
    showModifBanner(date = new Date()) {
        if (typeof window.showModifBanner === 'function') {
            try {
                window.showModifBanner(date);
            } catch (error) {
                console.warn('Erreur lors de l\'affichage du modif banner:', error);
            }
        }
    }

    /**
     * Enregistre une erreur dans le monitoring (sécurisé)
     */
    recordError(error) {
        if (window.healthMonitor && typeof window.healthMonitor.recordError === 'function') {
            try {
                window.healthMonitor.recordError({
                    type: 'refresh_service',
                    message: error?.message || 'Erreur inconnue du service de refresh',
                    source: 'RefreshService'
                });
            } catch (e) {
                console.warn('Erreur lors de l\'enregistrement dans healthMonitor:', e);
            }
        }
    }

    /**
     * Enregistre un refresh dans le monitoring (sécurisé)
     */
    recordRefresh() {
        if (window.healthMonitor && typeof window.healthMonitor.recordRefresh === 'function') {
            try {
                window.healthMonitor.recordRefresh();
            } catch (error) {
                console.warn('Erreur lors de l\'enregistrement du refresh:', error);
            }
        }
    }

    // =========================================================================
    // CLEANUP ET GESTION MÉMOIRE
    // =========================================================================

    /**
     * Annule toutes les requêtes en cours
     */
    async cancelAllRequests() {
        console.log(`🚫 Annulation de ${this.requestQueue.size} requête(s) en cours`);

        const promises = Array.from(this.requestQueue).map(async (request) => {
            try {
                request.controller.abort();
                clearTimeout(request.timeoutId);
            } catch (error) {
                console.warn('Erreur lors de l\'annulation d\'une requête:', error);
            }
        });

        await Promise.allSettled(promises);

        this.requestQueue.clear();
        this.currentRequest = null;
    }

    /**
     * Nettoie les ressources du service
     */
    async cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage RefreshService');

        // Marquer comme détruit pour empêcher les nouvelles opérations
        this.isDestroyed = true;

        // Arrêter le timer
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // Annuler toutes les requêtes en cours
        await this.cancelAllRequests();

        // Reset des propriétés
        this.isRefreshing = false;
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        this.lastHash = null;
        this.iframe = null;
        this.display = null;

        // Nettoyer les références de méthodes bound
        this.boundRefresh = null;
        this.boundRetry = null;
    }

    /**
     * Vérifie l'intégrité du service
     */
    checkIntegrity() {
        const issues = [];

        if (this.isDestroyed) {
            issues.push('Service marqué comme détruit');
        }

        if (this.isRefreshing && this.requestQueue.size === 0) {
            issues.push('État de refresh incohérent - aucune requête active');
        }

        if (this.timer && this.isDestroyed) {
            issues.push('Timer actif alors que le service est détruit');
        }

        if (this.requestQueue.size > 5) {
            issues.push(`Trop de requêtes en queue: ${this.requestQueue.size}`);
        }

        if (issues.length > 0) {
            console.warn('⚠️ Problèmes d\'intégrité RefreshService:', issues);
            return false;
        }

        return true;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RefreshService;
}