/**
 * Scale Handler - Optimized with better performance and error handling
 * Version 3.0 - Reduced complexity and improved efficiency
 */

// Import utility classes
import { ErrorReporter } from '../../src/utils/ErrorReporter.js';
import { EventManager } from '../../src/utils/EventManager.js';

/**
 * Iframe Document Accessor - Centralized iframe access with caching
 */
class IframeAccessor {
    constructor(iframe, cacheTimeout = 5000) {
        this.iframe = iframe;
        this.cache = { doc: null, lastAccess: 0, timeout: cacheTimeout };
    }

    getDocument() {
        if (this.isCacheValid()) {
            return this.cache.doc;
        }
        return this.refreshCache();
    }

    isCacheValid() {
        return this.cache.doc && 
               (Date.now() - this.cache.lastAccess) < this.cache.timeout;
    }

    refreshCache() {
        try {
            const doc = this.iframe.contentDocument;
            if (doc) {
                this.cache.doc = doc;
                this.cache.lastAccess = Date.now();
            }
            return doc;
        } catch (error) {
            console.warn('Cannot access iframe document:', error);
            return null;
        }
    }

    invalidateCache() {
        this.cache.doc = null;
        this.cache.lastAccess = 0;
    }
}

/**
 * Scale Handler - Focused on scaling logic only
 */
class ScaleHandler {
    constructor(iframe, errorReporter) {
        this.iframe = iframe;
        this.errorReporter = errorReporter || new ErrorReporter();
        this.iframeAccessor = new IframeAccessor(iframe);
        this.eventManager = new EventManager();
        
        this.contentW = window.innerWidth;
        this.contentH = window.innerHeight;
        this.resizeTimeout = null;
        this.loadTimeout = null;
        this.isReady = false;
        this.isDestroyed = false;
        this.resizeObserver = null;
        this.lastContentHash = null;

        this.config = {
            loadDelay: 150,
            resizeDebounce: 100,
            minScale: 0.1,
            maxScale: 50.0,
            centerContent: true,
            fillMode: 'contain'
        };

        this.init();
    }

    init() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler détruit, impossible d\'initialiser');
            return;
        }

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (!this.iframe || this.isDestroyed) return;

        this.eventManager.add(this.iframe, 'load', this.handleLoad.bind(this));
        this.eventManager.add(window, 'resize', this.handleResize.bind(this));
    }

    handleLoad() {
        if (this.isDestroyed) return;

        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        this.loadTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
                this.processLoad();
            }
        }, this.config.loadDelay);
    }

    handleResize() {
        if (this.isDestroyed) return;

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        this.resizeTimeout = setTimeout(() => {
            if (this.isReady && !this.isDestroyed) {
                this.applyScale();
            }
        }, this.config.resizeDebounce);
    }

    processLoad() {
        if (this.isDestroyed) return;

        const context = {
            iframe: !!this.iframe,
            isDestroyed: this.isDestroyed,
            contentDimensions: `${this.contentW}x${this.contentH}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };

        try {
            const doc = this.iframeAccessor.getDocument();
            if (!doc) {
                this.errorReporter.reportWarning('Cannot access iframe document', {
                    type: 'iframe_access_denied',
                    source: 'ScaleHandler',
                    metadata: context
                });
                return;
            }

            this.injectStyles(doc);
            this.measureContent(doc);
            this.applyScale();
            this.isReady = true;

            this.errorReporter.reportInfo('Scale handler loaded successfully', {
                type: 'scale_handler_ready',
                source: 'ScaleHandler',
                metadata: context
            });

            console.log(`📏 Contenu mesuré: ${this.contentW}×${this.contentH}px`);

        } catch (e) {
            this.errorReporter.report(e, {
                type: 'scale_handler_load_error',
                source: 'ScaleHandler',
                metadata: context
            });
        } finally {
            if (this.loadTimeout) {
                clearTimeout(this.loadTimeout);
                this.loadTimeout = null;
            }
        }
    }

    injectStyles(doc) {
        if (!doc || this.isDestroyed) return;

        if (doc.getElementById('huddleboard-scale-styles')) {
            return;
        }

        try {
            const style = doc.createElement('style');
            style.id = 'huddleboard-scale-styles';
            style.textContent = `
                html, body { 
                    overflow: hidden !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    box-sizing: border-box !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                
                * { 
                    box-sizing: border-box !important; 
                }
                
                body {
                    transform: translateZ(0);
                    backface-visibility: hidden;
                }
            `;

            doc.head.appendChild(style);
        } catch (error) {
            console.warn('Erreur lors de l\'injection des styles:', error);
        }
    }

    measureContent(doc) {
        if (!doc || this.isDestroyed) return;

        try {
            // Use ResizeObserver for efficient measurement if available
            if (!this.resizeObserver && window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(entries => {
                    const entry = entries[0];
                    if (entry && !this.isDestroyed) {
                        this.contentW = entry.contentRect.width || 1;
                        this.contentH = entry.contentRect.height || 1;
                        this.applyScale();
                    }
                });
                this.resizeObserver.observe(doc.documentElement);
                return;
            }
            
            // Fallback: cache measurements and only re-measure if content changed
            const contentHash = this.getContentHash(doc);
            if (contentHash === this.lastContentHash) {
                return; // Use cached dimensions
            }
            
            this.lastContentHash = contentHash;
            this.performMeasurement(doc);
        } catch (error) {
            console.warn('Erreur lors de la mesure du contenu:', error);
            this.useDefaultDimensions();
        }
    }

    getContentHash(doc) {
        try {
            // Simple hash based on document structure
            const html = doc.documentElement.outerHTML;
            return html.length.toString(16);
        } catch (error) {
            return Date.now().toString();
        }
    }

    performMeasurement(doc) {
        const measurements = {
            width: [
                doc.documentElement.scrollWidth,
                doc.documentElement.offsetWidth,
                doc.documentElement.clientWidth,
                doc.body?.scrollWidth || 0,
                doc.body?.offsetWidth || 0,
                doc.body?.clientWidth || 0
            ].filter(val => val > 0),

            height: [
                doc.documentElement.scrollHeight,
                doc.documentElement.offsetHeight,
                doc.documentElement.clientHeight,
                doc.body?.scrollHeight || 0,
                doc.body?.offsetHeight || 0,
                doc.body?.clientHeight || 0
            ].filter(val => val > 0)
        };

        this.contentW = Math.max(...measurements.width, 1);
        this.contentH = Math.max(...measurements.height, 1);

        // Validation with reasonable limits
        const MAX_SIZE = 20000;
        if (this.contentW > MAX_SIZE) {
            console.warn(`⚠️ Largeur très importante: ${this.contentW}px, limitée à ${MAX_SIZE}px`);
            this.contentW = MAX_SIZE;
        }

        if (this.contentH > MAX_SIZE) {
            console.warn(`⚠️ Hauteur très importante: ${this.contentH}px, limitée à ${MAX_SIZE}px`);
            this.contentH = MAX_SIZE;
        }
    }

    useDefaultDimensions() {
        this.contentW = window.innerWidth;
        this.contentH = window.innerHeight;
    }

    applyScale() {
        if (this.isDestroyed || !this.iframe) return;

        try {
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };

            const scale = this.calculateOptimalScale(viewport);
            const transform = this.buildTransform(scale, viewport);

            this.applyTransform(transform);
            this.logScalingInfo(scale, viewport);

        } catch (e) {
            this.errorReporter.report(e, {
                type: 'scale_apply_error',
                source: 'ScaleHandler'
            });
        }
    }

    calculateOptimalScale(viewport) {
        const scaleX = viewport.width / this.contentW;
        const scaleY = viewport.height / this.contentH;

        let scale;

        switch (this.config.fillMode) {
            case 'cover':
                scale = Math.max(scaleX, scaleY);
                break;
            case 'fill':
                return { x: scaleX, y: scaleY, uniform: false };
            case 'fit-width':
                scale = scaleX;
                break;
            case 'fit-height':
                scale = scaleY;
                break;
            case 'contain':
            default:
                scale = Math.min(scaleX, scaleY);
                break;
        }

        scale = Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
        return { x: scale, y: scale, uniform: true };
    }

    buildTransform(scale, viewport) {
        const scaledW = this.contentW * scale.x;
        const scaledH = this.contentH * scale.y;

        let left = 0;
        let top = 0;

        if (this.config.centerContent) {
            left = (viewport.width - scaledW) / 2;
            top = (viewport.height - scaledH) / 2;
        }

        return {
            width: this.contentW,
            height: this.contentH,
            scaleX: scale.x,
            scaleY: scale.y,
            left: Math.round(left),
            top: Math.round(top),
            scaledWidth: Math.round(scaledW),
            scaledHeight: Math.round(scaledH)
        };
    }

    applyTransform(transform) {
        if (this.isDestroyed || !this.iframe) return;

        const { width, height, scaleX, scaleY, left, top } = transform;

        try {
            const transformCSS = scaleX === scaleY
                ? `scale(${scaleX})`
                : `scale(${scaleX}, ${scaleY})`;

            Object.assign(this.iframe.style, {
                width: `${width}px`,
                height: `${height}px`,
                transform: transformCSS,
                transformOrigin: '0 0',
                left: `${left}px`,
                top: `${top}px`,
                position: 'absolute',
                border: 'none',
                background: 'transparent'
            });
        } catch (error) {
            console.warn('Erreur lors de l\'application de la transformation:', error);
        }
    }

    logScalingInfo(scale, viewport) {
        const scalePercent = scale.uniform
            ? `${(scale.x * 100).toFixed(1)}%`
            : `${(scale.x * 100).toFixed(1)}% × ${(scale.y * 100).toFixed(1)}%`;

        const finalSize = scale.uniform
            ? `${Math.round(this.contentW * scale.x)}×${Math.round(this.contentH * scale.y)}`
            : `${Math.round(this.contentW * scale.x)}×${Math.round(this.contentH * scale.y)}`;

        console.log(`🔍 Échelle: ${scalePercent} | ${this.contentW}×${this.contentH} → ${finalSize} | Mode: ${this.config.fillMode}`);
    }

    setFillMode(mode) {
        if (this.isDestroyed) return;

        const validModes = ['contain', 'cover', 'fill', 'fit-width', 'fit-height'];
        if (!validModes.includes(mode)) {
            console.error(`❌ Mode de remplissage invalide: ${mode}`);
            return;
        }

        console.log(`🔧 Changement de mode: ${this.config.fillMode} → ${mode}`);
        this.config.fillMode = mode;

        if (this.isReady) {
            this.applyScale();
        }
    }

    forceUpdate() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler détruit, impossible de forcer la mise à jour');
            return;
        }

        console.log('🔄 Mise à jour forcée du scaling');
        this.isReady = false;
        this.iframeAccessor.invalidateCache();
        this.lastContentHash = null;
        
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.processLoad();
            }
        }, this.config.loadDelay);
    }

    getScaleInfo() {
        if (this.isDestroyed) {
            return {
                isDestroyed: true,
                contentDimensions: null,
                viewport: null,
                scale: null,
                config: null,
                isReady: false
            };
        }

        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        const scale = this.isReady ? this.calculateOptimalScale(viewport) : { x: 1, y: 1, uniform: true };

        return {
            contentDimensions: {
                width: this.contentW,
                height: this.contentH,
                aspectRatio: this.contentW / this.contentH
            },
            viewport: viewport,
            scale: scale,
            config: { ...this.config },
            isReady: this.isReady,
            isDestroyed: this.isDestroyed
        };
    }

    updateConfig(newConfig) {
        if (this.isDestroyed) return;

        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        console.log('⚙️ Configuration scaling mise à jour');

        const criticalChanges = ['fillMode', 'maxScale', 'minScale', 'centerContent'];
        const shouldReapply = criticalChanges.some(key =>
            newConfig[key] !== undefined && newConfig[key] !== oldConfig[key]
        );

        if (shouldReapply && this.isReady) {
            this.applyScale();
        }
    }

    checkIntegrity() {
        const issues = [];

        if (this.isDestroyed) {
            issues.push('Gestionnaire marqué comme détruit');
        }

        if (this.isReady && (!this.contentW || !this.contentH)) {
            issues.push('Dimensions de contenu invalides');
        }

        if (this.iframe && this.isDestroyed) {
            issues.push('Référence iframe conservée alors que le gestionnaire est détruit');
        }

        if (this.loadTimeout && this.isDestroyed) {
            issues.push('Timeout actif alors que le gestionnaire est détruit');
        }

        if (issues.length > 0) {
            console.warn('⚠️ Problèmes d\'intégrité ScaleHandler:', issues);
            return false;
        }

        return true;
    }

    cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage ScaleHandler');
        this.isDestroyed = true;

        // Clean up timeouts
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // Clean up ResizeObserver
        if (this.resizeObserver) {
            try {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            } catch (error) {
                console.warn('Erreur lors du nettoyage ResizeObserver:', error);
            }
        }

        // Clean up event listeners
        this.eventManager.removeAll();
        
        // Clean up cache
        this.iframeAccessor.invalidateCache();
        
        // Reset properties
        this.isReady = false;
        this.iframe = null;
        this.contentW = 0;
        this.contentH = 0;
        this.lastContentHash = null;
        this.iframeAccessor = null;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScaleHandler, IframeAccessor };
}

// Make ScaleHandler globally available for non-module scripts
window.ScaleHandler = ScaleHandler;