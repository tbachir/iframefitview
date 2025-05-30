/**
 * Module de monitoring autonome pour iframe
 * Ajouter simplement <script src="iframe-monitor.js"></script> pour l'activer
 */
(function () {
    'use strict';

    class IframeMonitor {
        constructor() {
            this.iframe = null;
            this.checkInterval = 30000; // 30 secondes
            this.monitoringInterval = null;
            this.observer = null;
            this.indicator = null;
            this.retryCount = 0;
            this.maxRetries = 3;

            // Démarrer l'observation
            this.init();
        }

        init() {
            // Observer les changements dans le DOM
            this.observer = new MutationObserver(() => {
                this.checkForIframe();
            });

            // Observer tout le document
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Vérification initiale
            this.checkForIframe();

            // Nettoyer lors du déchargement de la page
            window.addEventListener('beforeunload', () => this.cleanup());
        }

        checkForIframe() {
            const iframe = document.querySelector('.iframe-container iframe');

            if (iframe && !this.iframe) {
                // Nouvel iframe détecté
                this.startMonitoring(iframe);
            } else if (!iframe && this.iframe) {
                // Iframe supprimé
                this.stopMonitoring();
            }
        }

        startMonitoring(iframe) {
            console.log('[IframeMonitor] Monitoring démarré');
            this.iframe = iframe;
            this.createIndicator();

            // Écouter les événements de l'iframe
            this.iframe.addEventListener('load', () => this.onIframeLoad());
            this.iframe.addEventListener('error', () => this.onIframeError());

            // Vérification initiale
            this.checkHealth();

            // Démarrer le monitoring périodique
            this.monitoringInterval = setInterval(() => {
                this.checkHealth();
            }, this.checkInterval);
        }

        stopMonitoring() {
            console.log('[IframeMonitor] Monitoring arrêté');

            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }

            if (this.indicator) {
                this.indicator.remove();
                this.indicator = null;
            }

            this.iframe = null;
            this.retryCount = 0;
        }

        async checkHealth() {
            if (!this.iframe) return;

            const src = this.iframe.src;
            if (!src || src === 'about:blank') return;

            // Extraire le chemin sans les paramètres
            const url = new URL(src, window.location.href);
            const path = url.pathname;

            try {
                const start = Date.now();
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const response = await fetch(path, {
                    method: 'HEAD',
                    cache: 'no-cache',
                    signal: controller.signal
                });

                clearTimeout(timeout);
                const responseTime = Date.now() - start;

                if (response.ok) {
                    this.updateStatus('healthy', `OK (${responseTime}ms)`);
                    this.retryCount = 0;
                } else {
                    this.updateStatus('error', `Erreur HTTP ${response.status}`);
                    this.handleError();
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    this.updateStatus('timeout', 'Timeout - Réponse trop lente');
                } else {
                    this.updateStatus('offline', 'Hors ligne ou inaccessible');
                }
                this.handleError();
            }
        }

        handleError() {
            this.retryCount++;

            if (this.retryCount <= this.maxRetries) {
                this.updateStatus('retry', `Tentative ${this.retryCount}/${this.maxRetries}`);

                // Réessayer après un délai
                setTimeout(() => {
                    if (this.iframe) {
                        // Forcer le rechargement
                        const src = this.iframe.src;
                        const url = new URL(src);
                        url.searchParams.set('t', Date.now());
                        this.iframe.src = url.toString();
                    }
                }, 5000);
            }
        }

        onIframeLoad() {
            // L'iframe s'est chargé avec succès
            this.checkHealth();
        }

        onIframeError() {
            this.updateStatus('error', 'Erreur de chargement');
            this.handleError();
        }

        createIndicator() {
            // Créer le conteneur d'indicateurs
            this.indicator = document.createElement('div');
            this.indicator.className = 'iframe-monitor-indicator';
            this.indicator.innerHTML = `
                <span class="monitor-status">●</span>
                <span class="monitor-message"></span>
            `;

            // Chercher où l'insérer (header ou body)
            const header = document.querySelector('body');
            if (header) {
                header.appendChild(this.indicator);
            } else {
                // Fallback : position fixe
                this.indicator.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 10000;
                    background: white;
                    padding: 5px 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(this.indicator);
            }

            // Ajouter les styles si pas déjà présents
            if (!document.querySelector('#iframe-monitor-styles')) {
                const style = document.createElement('style');
                style.id = 'iframe-monitor-styles';
                style.textContent = `
                    .iframe-monitor-indicator {
                    position: fixed;
    top: 5px;
    right: 5px;
}
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        font-size: 12px;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    
                    .monitor-status {
                        font-size: 16px;
                        line-height: 1;
                        transition: color 0.3s ease;
                    }
                    
                    .monitor-message {
                        color: #666;
                        white-space: nowrap;
                    }
                    
                    /* États */
                    .monitor-healthy .monitor-status { color: #10b981; }
                    .monitor-error .monitor-status { color: #ef4444; }
                    .monitor-timeout .monitor-status { color: #f59e0b; }
                    .monitor-offline .monitor-status { color: #6b7280; }
                    .monitor-retry .monitor-status { 
                        color: #3b82f6;
                        animation: pulse 1s infinite;
                    }
                    
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    
                    /* Animation de mise à jour */
                    .monitor-updating {
                        animation: rotate 1s linear infinite;
                    }
                    
                    @keyframes rotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        updateStatus(status, message) {
            if (!this.indicator) return;

            const statusEl = this.indicator.querySelector('.monitor-status');
            const messageEl = this.indicator.querySelector('.monitor-message');

            // Retirer toutes les classes d'état
            this.indicator.className = 'iframe-monitor-indicator monitor-' + status;

            // Mettre à jour le message
            messageEl.textContent = message;

            // Tooltip avec plus d'infos
            const time = new Date().toLocaleTimeString('fr-FR');
            this.indicator.title = `${message}\nDernière vérification: ${time}`;

            // Animation de mise à jour
            statusEl.classList.add('monitor-updating');
            setTimeout(() => {
                statusEl.classList.remove('monitor-updating');
            }, 500);
        }

        cleanup() {
            this.stopMonitoring();

            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }
    }

    // Auto-démarrage quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.iframeMonitor = new IframeMonitor();
        });
    } else {
        // DOM déjà chargé
        window.iframeMonitor = new IframeMonitor();
    }

})();