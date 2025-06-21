/**
 * HuddleBoard Main Application
 * Core application logic extracted from index.html for better modularity
 */

// Import utility classes
import { ErrorReporter } from '../src/utils/ErrorReporter.js';
import { EventManager } from '../src/utils/EventManager.js';
import { TimeFormatter } from '../src/utils/TimeFormatter.js';
import { BannerManager } from '../src/utils/BannerManager.js';

/**
 * Core Application - Refactored with utilities
 */
class Core {
    constructor() {
        this.display = null;
        this.displayManager = null;
        this.errorReporter = new ErrorReporter();
        this.bannerManager = new BannerManager();
        this.modifBannerTimer = null;
    }

    init() {
        console.log('🚀 Initialisation HuddleBoard Display');

        try {
            if (!this.validateConfig()) {
                this.showConfigError();
                return;
            }

            if (!this.loadDisplay()) {
                this.showDisplayError();
                return;
            }

            this.initDisplayManager();
            console.log('✅ HuddleBoard Display initialisé avec succès');
        } catch (error) {
            this.errorReporter.report(error, {
                type: 'core_init_error',
                source: 'Core'
            });
            this.showConfigError();
        }
    }

    validateConfig() {
        // Use the ConfigValidator from config.js
        if (typeof ConfigValidator === 'undefined') {
            console.error('ConfigValidator not available from config.js');
            return false;
        }

        const validation = ConfigValidator.validate(window.AppConfig);
        if (!validation.isValid) {
            this.errorReporter.report(new Error('Configuration validation failed'), {
                type: 'config_validation_error',
                source: 'Core',
                metadata: { errors: validation.errors }
            });
            return false;
        }
        return true;
    }

    loadDisplay() {
        const hash = window.location.hash;
        const slug = hash?.startsWith('#/') ? hash.substring(2) : null;

        if (!slug) {
            this.errorReporter.reportWarning('Missing slug in URL', {
                type: 'missing_slug',
                source: 'Core'
            });
            return false;
        }

        this.display = window.AppConfig.displays.find(d => d?.slug === slug);

        if (!this.display) {
            this.errorReporter.reportWarning(`Display '${slug}' not found`, {
                type: 'display_not_found',
                source: 'Core',
                metadata: { slug }
            });
            return false;
        }

        console.log(`📺 Display chargé: ${this.display.name} (${this.display.slug})`);
        return true;
    }

    initDisplayManager() {
        // Pass bannerManager to DisplayManager
        this.displayManager = new DisplayManager(this.display, this.errorReporter, this.bannerManager);
        this.displayManager.render();
    }

    showConfigError() {
        document.getElementById('app').innerHTML = `
            <div style="padding: 50px; text-align: center; font-family: Arial; color: #dc2626;">
                <h2>❌ Configuration manquante</h2>
                <p>Le fichier config.js est manquant ou invalide</p>
                <a href="../" style="color: #dc2626; text-decoration: none;">← Retour à l'accueil</a>
            </div>
        `;
    }

    showDisplayError() {
        const hash = window.location.hash?.substring(2) || 'unknown';
        document.getElementById('app').innerHTML = `
            <div style="padding: 50px; text-align: center; font-family: Arial; color: #dc2626;">
                <h2>❌ Display non trouvé</h2>
                <p>Le display '${hash}' n'existe pas dans la configuration</p>
                <a href="../" style="color: #dc2626; text-decoration: none;">← Retour à l'accueil</a>
            </div>
        `;
    }

    // Banner methods using BannerManager
    showModifBanner(date = new Date()) {
        try {
            localStorage.setItem('hb_sync', date.getTime());
        } catch (e) {
            console.warn('Impossible de sauvegarder la date de sync:', e);
        }

        if (this.modifBannerTimer) {
            clearInterval(this.modifBannerTimer);
        }

        const updateTime = () => {
            try {
                const lastSync = localStorage.getItem('hb_sync');
                const syncDate = lastSync ? new Date(parseInt(lastSync)) : date;
                const timeAgo = TimeFormatter.formatTimeAgo(syncDate);

                this.bannerManager.update('modif-banner', { timeAgo });
            } catch (e) {
                console.warn('Erreur lors de la mise à jour du banner:', e);
            }
        };

        const timeAgo = TimeFormatter.formatTimeAgo(date);
        this.bannerManager.show('modif', { timeAgo }, { id: 'modif-banner' });
        
        updateTime();
        this.modifBannerTimer = setInterval(updateTime, 60000);
    }

    showStatusBanner(date, ok = true, errorCount = 0) {
        this.showStatusBanner.lastDate = ok && date ? date : this.showStatusBanner.lastDate;

        let statusClass, statusText, secondaryText;

        if (!ok) {
            statusClass = 'status-fail';
            statusText = 'Hors ligne';
            secondaryText = 'Reconnexion...';
        } else if (errorCount > 5) {
            statusClass = 'status-warning';
            statusText = 'Instable';
            secondaryText = `${errorCount} erreurs`;
        } else {
            statusClass = 'status-online';
            statusText = 'En ligne';
            secondaryText = TimeFormatter.formatTime(this.showStatusBanner.lastDate);
        }

        this.bannerManager.show('status', {
            statusClass,
            statusText,
            secondaryText
        }, { id: 'status-banner' });
    }

    showLoadingBanner(message = 'Chargement...') {
        this.bannerManager.show('loading', { message }, { id: 'loading-banner' });
    }

    showErrorBanner(message, duration = 5000) {
        this.bannerManager.show('error', { message }, { 
            id: 'error-banner',
            duration 
        });
    }

    showWarningBanner(message, duration = 5000) {
        this.bannerManager.show('warning', { message }, { 
            id: 'warning-banner',
            duration 
        });
    }

    hideLoadingBanner() {
        this.bannerManager.hide('loading-banner');
    }

    cleanup() {
        console.log('🧹 Nettoyage Core Application');

        if (this.modifBannerTimer) {
            clearInterval(this.modifBannerTimer);
            this.modifBannerTimer = null;
        }

        this.bannerManager.cleanup();

        if (this.displayManager) {
            this.displayManager.cleanup();
            this.displayManager = null;
        }

        this.display = null;
    }

    async getAppInfo() {
        return {
            display: this.display ? {
                name: this.display.name,
                slug: this.display.slug,
                path: this.display.path
            } : null,
            displayManager: this.displayManager ? this.displayManager.getDisplayInfo() : null,
            lastSync: this.getLastSyncInfo()
        };
    }

    getLastSyncInfo() {
        try {
            const lastSync = localStorage.getItem('hb_sync');
            if (lastSync) {
                const date = new Date(parseInt(lastSync));
                return {
                    timestamp: parseInt(lastSync),
                    date: date.toLocaleString(),
                    timeAgo: TimeFormatter.formatTimeAgo(date)
                };
            }
        } catch (e) {
            console.warn('Erreur lors de la lecture de la dernière sync:', e);
        }
        return null;
    }
}

// Initialize application
const app = new Core();

// Event handlers
window.addEventListener('beforeunload', () => app.cleanup());
window.addEventListener('hashchange', () => {
    console.log('🔄 Changement de hash détecté, rechargement...');
    app.cleanup();
    setTimeout(() => app.init(), 100);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Expose for debugging
window.HuddleBoardApp = app;
window.debug = {
    getAppInfo: () => app.getAppInfo(),
    forceRefresh: () => app.displayManager?.forceRefresh(),
    getScaleInfo: () => app.displayManager?.scaleHandler?.getScaleInfo(),
    getRefreshStats: () => app.displayManager?.refreshService?.getStats(),
    setFillMode: (mode) => app.displayManager?.scaleHandler?.setFillMode(mode),
};

console.log('🛠️ Commandes debug disponibles: window.debug');

// Export for module usage
export default app;