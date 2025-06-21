/**
 * Refresh Service - Optimized with better error handling and performance
 * Version 3.0 - Reduced complexity and improved reliability
 */
class RefreshService {
    constructor(display, iframe, errorReporter) {
        this.display = display;
        this.iframe = iframe;
        this.errorReporter = errorReporter || new ErrorReporter();
        this.interval = display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000;
        this.timer = null;
        this.lastHash = null;
        this.isRefreshing = false;
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        this.isDestroyed = false;

        this.currentRequest = null;
        this.requestQueue = new Set();

        this.config = {
            maxRetries: 3,
            retryDelay: 5000,
            timeoutDuration: 10000,
            maxConsecutiveErrors: 5,
            slowdownMultiplier: 2,
            maxInterval: 300000,
            minInterval: 5000
        };

        this.start();
    }

    start() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService détruit, impossible de démarrer');
            return;
        }

        console.log(`🔄 Service de refresh démarré (intervalle: ${this.interval}ms)`);
        this.refresh();
        this.scheduleNext();
    }

    scheduleNext() {
        if (this.isDestroyed) return;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.timer = setInterval(() => this.refresh(), this.interval);
    }

    async refresh() {
        if (this.isDestroyed || this.isRefreshing) {
            if (this.isRefreshing) {
                console.log('⏭️ Refresh déjà en cours, ignoré');
            }
            return;
        }

        this.isRefreshing = true;

        try {
            await this.performRefresh();
        } catch (error) {
            this.errorReporter.report(error, {
                type: 'refresh_unexpected_error',
                source: 'RefreshService'
            });
            this.handleFailedRefresh(error);
        } finally {
            this.isRefreshing = false;
        }
    }

    async performRefresh() {
        const request = await this.prepareRequest();
        if (!request) return;

        try {
            const result = await this.executeRequest(request);
            await this.processResult(result, request);
        } catch (error) {
            this.handleRequestError(error, request);
        } finally {
            this.cleanupRequest(request);
        }
    }

    async prepareRequest() {
        await this.cancelCurrentRequest();
        const request = this.createRequest();
        this.currentRequest = request;
        this.requestQueue.add(request);
        return request;
    }

    async executeRequest(request) {
        const result = await this.fetchContentWithRequest(request);
        
        if (request.signal.aborted) {
            this.errorReporter.reportInfo('Request was cancelled', { 
                type: 'refresh_cancelled',
                source: 'RefreshService'
            });
            throw new Error('Request cancelled');
        }
        
        if (this.isDestroyed) {
            this.errorReporter.reportWarning('Service destroyed during request', {
                type: 'service_destroyed',
                source: 'RefreshService'
            });
            throw new Error('Service destroyed');
        }
        
        return result;
    }

    async processResult(result, request) {
        if (result.success) {
            this.handleSuccessfulRefresh(result);
        } else {
            this.handleFailedRefresh(result.error);
        }
    }

    handleRequestError(error, request) {
        if (error.message === 'Request cancelled') {
            return; // Already logged
        }
        
        this.errorReporter.report(error, {
            type: 'refresh_request_error',
            source: 'RefreshService',
            metadata: { requestId: request.timestamp }
        });
        
        this.handleFailedRefresh(error);
    }

    cleanupRequest(request) {
        this.requestQueue.delete(request);
        if (this.currentRequest === request) {
            this.currentRequest = null;
        }
    }

    async cancelCurrentRequest() {
        if (this.currentRequest) {
            try {
                this.currentRequest.controller.abort();
                await new Promise(resolve => setTimeout(resolve, 0));
            } catch (error) {
                console.warn('Erreur lors de l\'annulation de requête:', error);
            }
        }
    }

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
            clearTimeout(request.timeoutId);
            
            if (error.name === 'AbortError') {
                return { success: false, error: 'Request aborted' };
            }

            return { success: false, error: error };
        }
    }

    handleSuccessfulRefresh(result) {
        if (this.isDestroyed) return;

        const { content, timestamp, url } = result;

        this.consecutiveErrors = 0;
        this.retryCount = 0;

        this.showStatusBanner(timestamp, true);

        if (content && this.hasContentChanged(content)) {
            console.log('📄 Contenu modifié détecté, rechargement...');
            this.reloadIframe(url);
            
            try { 
                localStorage.setItem('hb_sync', timestamp.getTime()); 
            } catch(e) {
                console.warn('Impossible de sauvegarder la date de sync:', e);
            }
            
            this.showModifBanner(timestamp);
        }

        this.recordRefresh();

        if (this.interval > (this.display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000)) {
            this.speedUp();
        }
    }

    handleFailedRefresh(error) {
        if (this.isDestroyed) return;

        this.consecutiveErrors++;
        this.retryCount++;

        console.error(`❌ Erreur refresh (tentative ${this.retryCount}/${this.config.maxRetries}):`, error);

        this.showStatusBanner(undefined, false, this.consecutiveErrors);
        this.recordError(error);

        if (this.shouldSlowDown(this.consecutiveErrors)) {
            console.log('⚠️ Trop d\'erreurs, ralentissement du refresh');
            this.slowDown();
        }

        if (this.retryCount < this.config.maxRetries) {
            this.scheduleRetry();
        } else {
            this.retryCount = 0;
        }
    }

    scheduleRetry() {
        if (this.isDestroyed) return;

        console.log(`🔄 Nouvelle tentative dans ${this.config.retryDelay}ms`);
        
        setTimeout(() => {
            if (!this.isDestroyed && !this.isRefreshing) {
                this.refresh();
            }
        }, this.config.retryDelay);
    }

    shouldSlowDown(consecutiveErrors) {
        return consecutiveErrors >= this.config.maxConsecutiveErrors;
    }

    hasContentChanged(newContent) {
        if (!newContent) return false;

        const newHash = this.calculateHash(newContent);

        if (!this.lastHash) {
            this.lastHash = newHash;
            return false;
        }

        const hasChanged = newHash !== this.lastHash;

        if (hasChanged) {
            console.log(`🔍 Hash changé: ${this.lastHash} → ${newHash}`);
            this.lastHash = newHash;
        }

        return hasChanged;
    }

    async calculateHash(text) {
        if (typeof text !== 'string') return '0';
        
        // Use Web Crypto API for better performance on large content
        if (text.length > 10000 && window.crypto?.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(text);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
            } catch (e) {
                // Fallback to simple hash
            }
        }
        
        // Simple hash for smaller content
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
        }
        return (hash >>> 0).toString(16);
    }

    reloadIframe(url) {
        if (this.iframe && !this.isDestroyed) {
            console.log('🔄 Rechargement iframe avec nouveau contenu');
            this.iframe.src = url || this.buildUrl();
        }
    }

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

    speedUp() {
        const originalInterval = this.display.refreshInterval || window.AppConfig?.defaultRefreshInterval || 30000;
        const oldInterval = this.interval;

        this.interval = Math.max(originalInterval, this.config.minInterval);

        if (this.interval !== oldInterval) {
            console.log(`🚀 Accélération: ${oldInterval}ms → ${this.interval}ms`);
            this.scheduleNext();
        }
    }

    buildUrl() {
        const base = this.display.path;
        const separator = base.includes('?') ? '&' : '?';
        const timestamp = Date.now();
        return `${base}${separator}t=${timestamp}&r=${Math.random().toString(36).substr(2, 9)}`;
    }

    forceRefresh() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService détruit, impossible de forcer le refresh');
            return;
        }

        console.log('🔄 Refresh forcé');
        this.lastHash = null;
        this.consecutiveErrors = 0;
        this.retryCount = 0;

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

    pause() {
        if (this.isDestroyed) return;

        console.log('⏸️ Service de refresh mis en pause');
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.cancelAllRequests();
    }

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

    updateInterval(newInterval) {
        if (this.isDestroyed) return;

        const oldInterval = this.interval;
        this.interval = Math.max(newInterval, this.config.minInterval);

        console.log(`⏱️ Intervalle mis à jour: ${oldInterval}ms → ${this.interval}ms`);

        if (this.timer) {
            this.scheduleNext();
        }
    }

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

    isActive() {
        return this.timer !== null && !this.isDestroyed;
    }

    isBusy() {
        return this.isRefreshing;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuration refresh mise à jour:', newConfig);
    }

    // Banner integration methods (using global functions for backward compatibility)
    showStatusBanner(date, ok = true, errorCount = 0) {
        if (typeof window.showStatusBanner === 'function') {
            try {
                window.showStatusBanner(date, ok, errorCount);
            } catch (error) {
                console.warn('Erreur lors de l\'affichage du status banner:', error);
            }
        }
    }

    showModifBanner(date = new Date()) {
        if (typeof window.showModifBanner === 'function') {
            try {
                window.showModifBanner(date);
            } catch (error) {
                console.warn('Erreur lors de l\'affichage du modif banner:', error);
            }
        }
    }

    recordError(error) {
        this.errorReporter.report(error, {
            type: 'refresh_service_error',
            source: 'RefreshService'
        });
    }

    recordRefresh() {
        if (window.healthMonitor && typeof window.healthMonitor.recordRefresh === 'function') {
            try {
                window.healthMonitor.recordRefresh();
            } catch (error) {
                console.warn('Erreur lors de l\'enregistrement du refresh:', error);
            }
        }
    }

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

    async cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ RefreshService déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage RefreshService');
        this.isDestroyed = true;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        await this.cancelAllRequests();

        this.isRefreshing = false;
        this.consecutiveErrors = 0;
        this.retryCount = 0;
        this.lastHash = null;
        this.iframe = null;
        this.display = null;
    }

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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RefreshService;
}