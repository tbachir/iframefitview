/**
 * Health Monitor - Système de surveillance de santé pour HuddleBoard
 * Usage: const monitor = new HealthMonitor(); monitor.init();
 */
class HealthMonitor {
    constructor() {
        this.enabled = false;
        this.stats = {
            startTime: Date.now(),
            refreshCount: 0,
            errorCount: 0,
            lastError: null,
            memoryWarnings: 0
        };
        this.healthInterval = null;
        this.reloadInterval = null;
        this.healthBannerElement = null; //  Cache banner element
        this.config = {
            healthCheckInterval: 30000,        // 30 secondes
            preventiveReloadInterval: 12 * 60 * 60 * 1000, // 12 heures
            memoryThreshold: 80,               // 80% d'utilisation mémoire
            maxMemoryWarnings: 5,              // Nombre max d'alertes avant reload
            maxConsecutiveErrors: 5            // Nombre max d'erreurs avant ralentissement
        };
    }

    /**
     * Initialise le monitoring selon la configuration
     */
    init() {
        // Vérifier la configuration globale et par display
        const globalConfig = window.AppConfig?.monitoring;
        const currentSlug = window.location.hash?.substring(2);
        const currentDisplay = window.AppConfig?.displays?.find(d => d?.slug === currentSlug);
        const displayConfig = currentDisplay?.monitoring;

        // Priorité : config du display > config globale > false par défaut
        this.enabled = displayConfig !== undefined ? displayConfig : (globalConfig !== undefined ? globalConfig : false);

        if (this.enabled) {
            console.log('🔍 Monitoring de santé activé');
            this.startMonitoring();
            this.setupGlobalErrorHandlers();
        } else {
            console.log('📴 Monitoring de santé désactivé');
        }

        return this.enabled;
    }

    /**
     * Démarre les intervalles de monitoring
     */
    startMonitoring() {
        if (!this.enabled) return;

        // Vérification de la santé
        this.healthInterval = setInterval(() => {
            this.checkHealth();
            this.updateHealthBanner();
        }, this.config.healthCheckInterval);

        // Reload préventif
        this.reloadInterval = setInterval(() => {
            console.log('🔄 Reload préventif après 12h');
            this.performPreventiveReload();
        }, this.config.preventiveReloadInterval);

        // Affichage initial du banner
        this.updateHealthBanner();
    }

    /**
     * Configure les gestionnaires d'erreurs globaux
     */
    setupGlobalErrorHandlers() {
        if (!this.enabled) return;

        window.addEventListener('error', (e) => {
            console.error('❌ Erreur globale:', e);
            this.recordError(e);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('❌ Promise rejetée:', e);
            this.recordError(e);
        });
    }

    /**
     * Vérifie l'état de santé du système
     */
    checkHealth() {
        if (!this.enabled) return;

        this.checkMemoryUsage();
        this.checkPerformance();
    }

    /**
     * Surveille l'utilisation mémoire
     */
    checkMemoryUsage() {
        if (!performance.memory) return;

        const usedMB = performance.memory.usedJSHeapSize / 1048576;
        const limitMB = performance.memory.jsHeapSizeLimit / 1048576;
        const usage = (usedMB / limitMB) * 100;

        if (usage > this.config.memoryThreshold) {
            this.stats.memoryWarnings++;
            console.warn(`⚠️ Mémoire élevée: ${usage.toFixed(1)}% (${usedMB.toFixed(1)}MB/${limitMB.toFixed(1)}MB)`);

            // Reload si trop de warnings
            if (this.stats.memoryWarnings > this.config.maxMemoryWarnings) {
                console.log('🔄 Reload pour libérer la mémoire');
                this.performMemoryReload();
            }
        }
    }

    /**
     * Vérifie les performances générales
     */
    checkPerformance() {
        // Vérifier si la page répond toujours
        const now = performance.now();
        setTimeout(() => {
            const delay = performance.now() - now;
            if (delay > 1000) { // Plus d'1 seconde de délai
                console.warn('⚠️ Ralentissement détecté:', delay + 'ms');
                this.recordError(`Performance degradation: ${delay}ms`);
            }
        }, 0);
    }

    /**
     * Met à jour le banner de santé
     */
    updateHealthBanner() {
        if (!this.enabled) return;

        //call with cached version
        if (!this.healthBannerElement) {
            this.healthBannerElement = this.getOrCreateBanner('health-banner', 'banner health-banner');
        }
        const banner = this.healthBannerElement;

        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000 / 60);
        const memoryInfo = this.getMemoryInfo();

        banner.innerHTML = `
            <div>Uptime: ${uptime}m | Refresh: ${this.stats.refreshCount} | Err: ${this.stats.errorCount}</div>
            ${memoryInfo ? `<div style="font-size: 0.7em; opacity: 0.8;">${memoryInfo}</div>` : ''}
        `;
    }

    /**
     * Récupère les informations mémoire formatées
     */
    getMemoryInfo() {
        if (!performance.memory) return null;

        const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        const limitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(1);
        const usage = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

        return `Mem: ${usedMB}/${limitMB}MB (${usage}%)`;
    }

    /**
     * Enregistre un refresh
     */
    recordRefresh() {
        if (this.enabled) {
            this.stats.refreshCount++;
        }
    }

    /**
     * Enregistre une erreur
     */
    recordError(error) {
        if (this.enabled) {
            this.stats.errorCount++;
            this.stats.lastError = {
                error: error,
                timestamp: new Date(),
                url: window.location.href
            };
            console.error('❌ Erreur enregistrée:', error);
        }
    }

    /**
     * Vérifie si le nombre d'erreurs consécutives est problématique
     */
    shouldSlowDown(consecutiveErrors) {
        return this.enabled && consecutiveErrors > this.config.maxConsecutiveErrors;
    }

    /**
     * Effectue un reload préventif
     */
    performPreventiveReload() {
        console.log('🔄 Reload préventif programmé');
        setTimeout(() => window.location.reload(), 1000);
    }

    /**
     * Effectue un reload pour libérer la mémoire
     */
    performMemoryReload() {
        console.log('🔄 Reload mémoire programmé');
        setTimeout(() => window.location.reload(), 2000);
    }

    /**
     * Crée ou récupère un banner
     */
    getOrCreateBanner(id, classes) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = classes;
            document.body.appendChild(el);
        }
        return el;
    }

    /**
     * Récupère les statistiques actuelles
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Vérifie si le monitoring est activé
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Nettoie les ressources du monitoring
     */
    cleanup() {
        console.log('🧹 Nettoyage du monitoring');

        if (this.healthInterval) {
            clearInterval(this.healthInterval);
            this.healthInterval = null;
        }

        if (this.reloadInterval) {
            clearInterval(this.reloadInterval);
            this.reloadInterval = null;
        }

        // Supprimer le banner de santé s'il existe
        if (this.healthBannerElement) { 
            this.healthBannerElement.remove();
            this.healthBannerElement = null;
        }
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HealthMonitor;
}