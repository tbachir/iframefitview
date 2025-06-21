/**
 * Display Manager - Gestionnaire d'affichage pour HuddleBoard
 * Gère le rendu et le cycle de vie des displays
 */
class DisplayManager {
    constructor(display) {
        this.display = display;
        this.iframe = null;
        this.scaleHandler = null;
        this.refreshService = null;
        this.loadTimeout = null;
    }

    /**
     * Effectue le rendu du display
     */
    render() {
        this.createHTML();
        this.setupIframe();
        this.initializeServices();
    }

    /**
     * Crée la structure HTML du display
     */
    createHTML() {
        document.getElementById('app').innerHTML = `
            <div class="display-header">
                <a href="../" class="back-button">←</a>
                <h3 style="margin: 0;">${this.display.name}</h3>
            </div>
            <div class="iframe-container">
                <iframe src="${this.display.path}" id="display-iframe"></iframe>
            </div>
        `;

        this.iframe = document.getElementById('display-iframe');
    }

    /**
     * Configure l'iframe et ses gestionnaires d'événements
     */
    setupIframe() {
        // Timeout pour le chargement de l'iframe (si monitoring activé)
        if (window.healthMonitor && window.healthMonitor.isEnabled()) {
            this.loadTimeout = setTimeout(() => {
                console.error('⏱️ Timeout chargement iframe');
                window.healthMonitor._recordError('Iframe load timeout');
                this.reloadIframe();
            }, 30000);

            this.iframe.addEventListener('load', () => {
                if (this.loadTimeout) {
                    clearTimeout(this.loadTimeout);
                    this.loadTimeout = null;
                }
            });

            this.iframe.addEventListener('error', (e) => {
                console.error('❌ Erreur iframe:', e);
                window.healthMonitor._recordError('Iframe error');

                // Clear timeout on error too
                if (this.loadTimeout) {
                    clearTimeout(this.loadTimeout);
                    this.loadTimeout = null;
                }

                setTimeout(() => this.reloadIframe(), 5000);
            });
        }
    }


    /**
     * Initialise les services associés
     */
    initializeServices() {
        // Initialiser le gestionnaire de mise à l'échelle
        this.scaleHandler = new ScaleHandler(this.iframe);

        // Initialiser le service de refresh
        this.refreshService = new RefreshService(this.display, this.iframe);
    }

    /**
     * Recharge l'iframe
     */
    reloadIframe() {
        if (this.iframe) {
            console.log('🔄 Rechargement iframe...');
            const currentSrc = this.iframe.src;
            this.iframe.src = 'about:blank';
            setTimeout(() => {
                this.iframe.src = currentSrc;
            }, 100);
        }
    }

    /**
     * Vérifie si l'iframe est accessible
     */
    isIframeAccessible() {
        try {
            return this.iframe && this.iframe.contentDocument !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * Récupère les informations du display
     */
    getDisplayInfo() {
        return {
            name: this.display.name,
            slug: this.display.slug,
            path: this.display.path,
            refreshInterval: this.display.refreshInterval,
            monitoring: this.display.monitoring,
            isLoaded: this.iframe && this.iframe.contentDocument !== null
        };
    }

    /**
     * Force un refresh du contenu
     */
    forceRefresh() {
        if (this.refreshService) {
            this.refreshService.forceRefresh();
        }
    }

    /**
     * Nettoie les ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage DisplayManager');

        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        if (this.scaleHandler) {
            this.scaleHandler.cleanup();
            this.scaleHandler = null;
        }

        if (this.refreshService) {
            this.refreshService.cleanup();
            this.refreshService = null;
        }

        this.iframe = null;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayManager;
}