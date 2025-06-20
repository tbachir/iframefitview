/**
 * Refresh Service - Service de rafraîchissement automatique
 * Surveille les changements de contenu et recharge si nécessaire
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
        this.abortController = null;
        this.retryCount = 0;
        
        this.config = {
            maxRetries: 3,
            retryDelay: 5000,
            timeoutDuration: 10000,
            maxConsecutiveErrors: 5,
            slowdownMultiplier: 2,
            maxInterval: 300000, // 5 minutes max
            minInterval: 5000    // 5 secondes min
        };

        this.start();
    }

    /**
     * Démarre le service de refresh
     */
    start() {
        console.log(`🔄 Service de refresh démarré (intervalle: ${this.interval}ms)`);
        this.refresh();
        this.scheduleNext();
    }

    /**
     * Programme le prochain refresh
     */
    scheduleNext() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(() => this.refresh(), this.interval);
    }

    /**
     * Effectue un refresh du contenu
     */
    async refresh() {
        if (this.isRefreshing) {
            console.log('⏭️ Refresh déjà en cours, ignoré');
            return;
        }
        
        this.isRefreshing = true;
        
        // Annuler la requête précédente si elle est toujours en cours
        if (this.abortController) {
            this.abortController.abort();
        }
        
        this.abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            this.abortController.abort();
        }, this.config.timeoutDuration);
        
        try {
            const result = await this.fetchContent();
            clearTimeout(timeoutId);
            
            if (result.success) {
                this.handleSuccessfulRefresh(result);
            } else {
                this.handleFailedRefresh(result.error);
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            this.handleFailedRefresh(error);
        } finally {
            this.isRefreshing = false;
            this.abortController = null;
        }
    }

    /**
     * Récupère le contenu distant
     */
    async fetchContent() {
        try {
            const preloadUrl = this.buildUrl();
            const now = new Date();
            
            console.log(`📡 Vérification de ${preloadUrl}`);
            
            const response = await fetch(preloadUrl, { 
                method: 'GET', 
                cache: 'no-cache',
                signal: this.abortController.signal,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
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
            if (error.name === 'AbortError') {
                console.log('🚫 Requête annulée');
                return { success: false, error: 'Request aborted' };
            }
            
            return { success: false, error: error };
        }
    }

    /**
     * Gère un refresh réussi
     */
    handleSuccessfulRefresh(result) {
        const { content, timestamp, url } = result;
        
        // Réinitialiser les compteurs d'erreur
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        
        // Afficher le statut de succès
        if (window.showStatusBanner) {
            window.showStatusBanner(timestamp, true);
        }
        
        // Vérifier si le contenu a changé
        if (content && this.hasContentChanged(content)) {
            console.log('📄 Contenu modifié détecté, rechargement...');
            this.reloadIframe(url);
            
            if (window.showModifBanner) {
                window.showModifBanner(timestamp);
            }
        }
        
        // Enregistrer le refresh dans le monitoring
        if (window.healthMonitor) {
            window.healthMonitor.recordRefresh();
        }
    }

    /**
     * Gère un refresh échoué
     */
    handleFailedRefresh(error) {
        this.consecutiveErrors++;
        this.retryCount++;
        
        console.error(`❌ Erreur refresh (tentative ${this.retryCount}/${this.config.maxRetries}):`, error);
        
        // Afficher le statut d'erreur
        if (window.showStatusBanner) {
            window.showStatusBanner(undefined, false);
        }
        
        // Enregistrer l'erreur dans le monitoring
        if (window.healthMonitor) {
            window.healthMonitor.recordError(error);
        }
        
        // Ralentir si trop d'erreurs consécutives
        if (window.healthMonitor && window.healthMonitor.shouldSlowDown(this.consecutiveErrors)) {
            console.log('⚠️ Trop d\'erreurs, ralentissement du refresh');
            this.slowDown();
        }
        
        // Retry si pas trop de tentatives
        if (this.retryCount < this.config.maxRetries) {
            console.log(`🔄 Nouvelle tentative dans ${this.config.retryDelay}ms`);
            setTimeout(() => {
                if (!this.isRefreshing) {
                    this.refresh();
                }
            }, this.config.retryDelay);
        } else {
            this.retryCount = 0; // Reset pour le prochain cycle
        }
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
        if (this.iframe) {
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
        console.log('🔄 Refresh forcé');
        this.lastHash = null; // Force la détection de changement
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        
        // Annuler le timer actuel et rafraîchir immédiatement
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.refresh().then(() => {
            this.scheduleNext();
        });
    }

    /**
     * Pause le service de refresh
     */
    pause() {
        console.log('⏸️ Service de refresh mis en pause');
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Reprend le service de refresh
     */
    resume() {
        console.log('▶️ Service de refresh repris');
        if (!this.timer) {
            this.scheduleNext();
        }
    }

    /**
     * Met à jour l'intervalle de refresh
     */
    updateInterval(newInterval) {
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
            isActive: this.timer !== null
        };
    }

    /**
     * Vérifie si le service est actif
     */
    isActive() {
        return this.timer !== null;
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

    /**
     * Nettoie les ressources du service
     */
    cleanup() {
        console.log('🧹 Nettoyage RefreshService');
        
        // Arrêter le timer
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Annuler les requêtes en cours
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        // Reset des propriétés
        this.isRefreshing = false;
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        this.lastHash = null;
        this.iframe = null;
        this.display = null;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RefreshService;
}