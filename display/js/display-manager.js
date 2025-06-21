/**
 * Display Manager - Refactored with Single Responsibility Principle
 * Version 3.0 - Focused on coordination and lifecycle management
 */

// Import utility classes
import { EventManager } from '../../src/utils/EventManager.js';
import { ErrorReporter } from '../../src/utils/ErrorReporter.js';

/**
 * Display Renderer - Handles HTML creation only
 */
class DisplayRenderer {
    constructor(display, errorReporter) {
        this.display = display;
        this.errorReporter = errorReporter;
    }

    render() {
        try {
            return this.createHTML();
        } catch (error) {
            this.errorReporter.report(error, {
                type: 'render_error',
                source: 'DisplayRenderer'
            });
            throw error;
        }
    }

    createHTML() {
        const appElement = document.getElementById('app');
        if (!appElement) {
            throw new Error('Élément #app non trouvé dans le DOM');
        }

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

        return document.getElementById('display-iframe');
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return String(text);
        
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
}

/**
 * Iframe Manager - Handles iframe lifecycle and events
 */
class IframeManager {
    constructor(iframe, errorReporter) {
        this.iframe = iframe;
        this.errorReporter = errorReporter;
        this.eventManager = new EventManager();
        this.loadTimeout = null;
        this.retryCount = 0;
        this.isDestroyed = false;

        this.config = {
            loadTimeoutDuration: 30000,
            errorRetryDelay: 5000,
            maxRetryAttempts: 3
        };
    }

    setup() {
        if (this.isDestroyed || !this.iframe) return;

        this.eventManager.add(this.iframe, 'load', this.handleLoad.bind(this));
        this.eventManager.add(this.iframe, 'error', this.handleError.bind(this));

        if (this.isMonitoringEnabled()) {
            this.startLoadTimeout();
        }
    }

    handleLoad() {
        if (this.isDestroyed) return;

        console.log('✅ Iframe chargée avec succès');
        this.clearLoadTimeout();
        this.retryCount = 0;

        this.errorReporter.reportInfo('Iframe loaded successfully', {
            type: 'iframe_loaded',
            source: 'IframeManager'
        });
    }

    handleError(event) {
        if (this.isDestroyed) return;

        console.error('❌ Erreur iframe:', event);
        this.clearLoadTimeout();

        this.errorReporter.report(new Error('Iframe load error'), {
            type: 'iframe_error',
            source: 'IframeManager'
        });

        this.scheduleRetry();
    }

    handleLoadTimeout() {
        console.log('🔄 Gestion du timeout de chargement');
        this.errorReporter.reportWarning('Iframe load timeout', {
            type: 'iframe_load_timeout',
            source: 'IframeManager'
        });
        this.scheduleRetry();
    }

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
            this.errorReporter.report(new Error('Max retry attempts reached'), {
                type: 'iframe_max_retries',
                source: 'IframeManager'
            });
        }
    }

    reloadIframe() {
        if (!this.iframe || this.isDestroyed) return;

        console.log('🔄 Rechargement iframe...');

        try {
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
            this.errorReporter.report(error, {
                type: 'iframe_reload_error',
                source: 'IframeManager'
            });
        }
    }

    startLoadTimeout() {
        this.clearLoadTimeout();
        this.loadTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
                this.handleLoadTimeout();
            }
        }, this.config.loadTimeoutDuration);
    }

    clearLoadTimeout() {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
    }

    isMonitoringEnabled() {
        return window.healthMonitor && 
               typeof window.healthMonitor.isEnabled === 'function' && 
               window.healthMonitor.isEnabled();
    }

    isAccessible() {
        if (!this.iframe || this.isDestroyed) return false;

        try {
            return this.iframe.contentDocument !== null;
        } catch (e) {
            return false;
        }
    }

    cleanup() {
        if (this.isDestroyed) return;

        console.log('🧹 Nettoyage IframeManager');
        this.isDestroyed = true;

        this.clearLoadTimeout();
        this.eventManager.removeAll();
        this.iframe = null;
        this.retryCount = 0;
    }
}

/**
 * Service Coordinator - Manages service lifecycle
 */
class ServiceCoordinator {
    constructor(display, iframe, errorReporter, bannerManager) {
        this.display = display;
        this.iframe = iframe;
        this.errorReporter = errorReporter;
        this.bannerManager = bannerManager;
        this.services = new Map();
        this.isDestroyed = false;
    }

    initialize() {
        if (this.isDestroyed || !this.iframe) return;

        try {
            // Initialize scale handler
            const scaleHandler = new ScaleHandler(this.iframe, this.errorReporter);
            this.services.set('scale', scaleHandler);

            // Initialize refresh service if enabled
            if (this.shouldEnableRefresh()) {
                const refreshService = new RefreshService(this.display, this.iframe, this.errorReporter, this.bannerManager);
                this.services.set('refresh', refreshService);
            } else {
                console.log('📴 Service de refresh désactivé pour ce display');
            }

            this.errorReporter.reportInfo('Services initialized successfully', {
                type: 'services_initialized',
                source: 'ServiceCoordinator',
                metadata: { serviceCount: this.services.size }
            });

        } catch (error) {
            this.errorReporter.report(error, {
                type: 'services_init_error',
                source: 'ServiceCoordinator'
            });
        }
    }

    shouldEnableRefresh() {
        if (this.display.monitoring === false) return false;
        if (window.AppConfig && window.AppConfig.monitoring === false) return false;
        return true;
    }

    getService(name) {
        return this.services.get(name);
    }

    forceRefresh() {
        const refreshService = this.services.get('refresh');
        if (refreshService && typeof refreshService.forceRefresh === 'function') {
            refreshService.forceRefresh();
        } else {
            // Fallback: reload iframe via iframe manager
            const iframeManager = this.services.get('iframe');
            if (iframeManager) {
                iframeManager.reloadIframe();
            }
        }
    }

    async cleanup() {
        if (this.isDestroyed) return;

        console.log('🧹 Nettoyage ServiceCoordinator');
        this.isDestroyed = true;

        const cleanupPromises = [];

        for (const [name, service] of this.services) {
            try {
                if (typeof service.cleanup === 'function') {
                    const result = service.cleanup();
                    if (result instanceof Promise) {
                        cleanupPromises.push(result);
                    }
                }
            } catch (error) {
                console.warn(`Erreur lors du nettoyage du service ${name}:`, error);
            }
        }

        if (cleanupPromises.length > 0) {
            try {
                await Promise.allSettled(cleanupPromises);
            } catch (error) {
                console.warn('Erreur lors du cleanup asynchrone des services:', error);
            }
        }

        this.services.clear();
        this.display = null;
        this.iframe = null;
        this.bannerManager = null;
    }
}

/**
 * Display Manager - Coordinating class with single responsibility
 */
class DisplayManager {
    constructor(display, errorReporter, bannerManager) {
        this.display = display;
        this.errorReporter = errorReporter || new ErrorReporter();
        this.bannerManager = bannerManager;
        this.renderer = new DisplayRenderer(display, this.errorReporter);
        this.iframeManager = null;
        this.serviceCoordinator = null;
        this.iframe = null;
        this.isDestroyed = false;
    }

    render() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager détruit, impossible de rendre');
            return;
        }

        try {
            // Render HTML and get iframe
            this.iframe = this.renderer.render();
            
            if (!this.iframe) {
                throw new Error('Impossible de créer l\'iframe');
            }

            // Initialize managers
            this.iframeManager = new IframeManager(this.iframe, this.errorReporter);
            this.serviceCoordinator = new ServiceCoordinator(this.display, this.iframe, this.errorReporter, this.bannerManager);

            // Setup iframe and services
            this.iframeManager.setup();
            this.serviceCoordinator.initialize();

        } catch (error) {
            this.errorReporter.report(error, {
                type: 'display_manager_render_error',
                source: 'DisplayManager'
            });
        }
    }

    forceRefresh() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager détruit, impossible de forcer le refresh');
            return;
        }

        if (this.serviceCoordinator) {
            this.serviceCoordinator.forceRefresh();
        }
    }

    getDisplayInfo() {
        if (this.isDestroyed) {
            return {
                isDestroyed: true,
                name: null,
                slug: null,
                path: null,
                isLoaded: false
            };
        }

        return {
            name: this.display.name,
            slug: this.display.slug,
            path: this.display.path,
            refreshInterval: this.display.refreshInterval,
            monitoring: this.display.monitoring,
            isLoaded: this.iframeManager ? this.iframeManager.isAccessible() : false,
            retryCount: this.iframeManager ? this.iframeManager.retryCount : 0,
            isDestroyed: this.isDestroyed
        };
    }

    // Delegate to services
    get scaleHandler() {
        return this.serviceCoordinator?.getService('scale');
    }

    get refreshService() {
        return this.serviceCoordinator?.getService('refresh');
    }

    async cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ DisplayManager déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage DisplayManager');
        this.isDestroyed = true;

        // Cleanup in reverse order of initialization
        if (this.serviceCoordinator) {
            await this.serviceCoordinator.cleanup();
            this.serviceCoordinator = null;
        }

        if (this.iframeManager) {
            this.iframeManager.cleanup();
            this.iframeManager = null;
        }

        this.iframe = null;
        this.display = null;
        this.renderer = null;
        this.bannerManager = null;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DisplayManager, DisplayRenderer, IframeManager, ServiceCoordinator };
}

// Make DisplayManager globally available for non-module scripts
window.DisplayManager = DisplayManager;