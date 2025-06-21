/**
 * Scale Handler - Gestionnaire de mise à l'échelle universel
 * Adapte automatiquement la taille du contenu iframe à toutes les résolutions
 * Version 2.1 - Corrections memory leaks et optimisations
 */
class ScaleHandler {
    constructor(iframe) {
        this.iframe = iframe;
        this.contentW = window.innerWidth;
        this.contentH = window.innerHeight;
        this.resizeTimeout = null;
        this.loadTimeout = null;
        this.isReady = false;
        this.isDestroyed = false;
        
        // Cache sécurisé pour le document iframe
        this.iframeDocCache = {
            doc: null,
            lastAccess: 0,
            maxAge: 5000 // 5 secondes de cache
        };

        this.config = {
            loadDelay: 150,              // Délai avant mesure du contenu
            resizeDebounce: 100,         // Debounce pour le resize
            minScale: 0.1,               // Échelle minimale
            maxScale: 50.0,              // Échelle maximale (sans limite pratique)
            centerContent: true,         // Centrer le contenu
            fillMode: 'contain'          // 'contain', 'cover', 'fill', 'fit-width', 'fit-height'
        };

        // Bind methods pour éviter les problèmes de contexte
        this.boundOnLoad = this.onLoad.bind(this);
        this.boundOnResize = this.onResize.bind(this);

        this.init();
    }

    /**
     * Initialise les gestionnaires d'événements
     */
    init() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler détruit, impossible d\'initialiser');
            return;
        }

        this.setupLoadHandler();
        this.setupResizeHandler();
    }

    /**
     * Configure le gestionnaire de chargement
     */
    setupLoadHandler() {
        if (!this.iframe || this.isDestroyed) return;

        this.iframe.addEventListener('load', this.boundOnLoad);
    }

    /**
     * Configure le gestionnaire de redimensionnement
     */
    setupResizeHandler() {
        if (this.isDestroyed) return;

        window.addEventListener('resize', this.boundOnResize);
    }

    /**
     * Gestionnaire de chargement de l'iframe (version bound)
     */
    onLoad() {
        if (this.isDestroyed) return;

        // Nettoyer le timeout de chargement précédent
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        this.loadTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
                this.handleLoad();
            }
        }, this.config.loadDelay);
    }

    /**
     * Gestionnaire de resize (version bound)
     */
    onResize() {
        if (this.isDestroyed) return;

        // Nettoyer le timeout de resize précédent
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

    /**
     * Gestionnaire de chargement de l'iframe
     */
    handleLoad() {
        if (this.isDestroyed) return;

        try {
            const doc = this.getIframeDocument();
            if (!doc) {
                console.warn('⚠️ Impossible d\'accéder au document de l\'iframe');
                return;
            }

            this.injectStyles(doc);
            this.measureContent(doc);
            this.applyScale();
            this.isReady = true;

            console.log(`📏 Contenu mesuré: ${this.contentW}×${this.contentH}px`);

        } catch (e) {
            console.error('❌ Erreur dans handleLoad:', e);
            this.recordError(e);
        } finally {
            // Nettoyer le timeout
            if (this.loadTimeout) {
                clearTimeout(this.loadTimeout);
                this.loadTimeout = null;
            }
        }
    }

    /**
     * Récupère le document de l'iframe de façon sécurisée avec cache
     */
    getIframeDocument() {
        if (this.isDestroyed || !this.iframe) return null;

        const now = Date.now();
        
        // Utiliser le cache si disponible et récent
        if (this.iframeDocCache.doc && 
            (now - this.iframeDocCache.lastAccess) < this.iframeDocCache.maxAge) {
            return this.iframeDocCache.doc;
        }

        try {
            const doc = this.iframe.contentDocument;
            if (doc) {
                // Mettre à jour le cache
                this.iframeDocCache.doc = doc;
                this.iframeDocCache.lastAccess = now;
            }
            return doc;
        } catch (error) {
            console.warn('Impossible d\'accéder au document iframe:', error);
            return null;
        }
    }

    /**
     * Invalide le cache du document iframe
     */
    invalidateDocumentCache() {
        this.iframeDocCache.doc = null;
        this.iframeDocCache.lastAccess = 0;
    }

    /**
     * Injecte les styles nécessaires dans l'iframe
     */
    injectStyles(doc) {
        if (!doc || this.isDestroyed) return;

        // Vérifier si les styles sont déjà injectés
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
                
                /* Optimisations de rendu */
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

    /**
     * Mesure les dimensions du contenu
     */
    measureContent(doc) {
        if (!doc || this.isDestroyed) return;

        try {
            // Méthodes de mesure multiples pour plus de précision
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

            // Utiliser la valeur la plus représentative
            this.contentW = Math.max(...measurements.width, 1);
            this.contentH = Math.max(...measurements.height, 1);

            // Validation des dimensions (limite raisonnable)
            const maxSize = 20000; // 20k pixels max

            if (this.contentW > maxSize) {
                console.warn(`⚠️ Largeur très importante: ${this.contentW}px, limitée à ${maxSize}px`);
                this.contentW = maxSize;
            }

            if (this.contentH > maxSize) {
                console.warn(`⚠️ Hauteur très importante: ${this.contentH}px, limitée à ${maxSize}px`);
                this.contentH = maxSize;
            }

        } catch (error) {
            console.warn('Erreur lors de la mesure du contenu:', error);
            // Utiliser des valeurs par défaut
            this.contentW = window.innerWidth;
            this.contentH = window.innerHeight;
        }
    }

    /**
     * Applique la mise à l'échelle
     */
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
            console.error('❌ Erreur dans applyScale:', e);
            this.recordError(e);
        }
    }

    /**
     * Calcule l'échelle optimale selon le mode de remplissage
     */
    calculateOptimalScale(viewport) {
        const scaleX = viewport.width / this.contentW;
        const scaleY = viewport.height / this.contentH;

        let scale;

        switch (this.config.fillMode) {
            case 'cover':
                // Remplit tout l'écran, peut rogner le contenu
                scale = Math.max(scaleX, scaleY);
                break;

            case 'fill':
                // Étire le contenu pour remplir exactement
                return { x: scaleX, y: scaleY, uniform: false };

            case 'fit-width':
                // Ajuste à la largeur
                scale = scaleX;
                break;

            case 'fit-height':
                // Ajuste à la hauteur
                scale = scaleY;
                break;

            case 'contain':
            default:
                // Contient tout le contenu visible (défaut)
                scale = Math.min(scaleX, scaleY);
                break;
        }

        // Appliquer les limites configurées
        scale = Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));

        return { x: scale, y: scale, uniform: true };
    }

    /**
     * Construit la transformation
     */
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

    /**
     * Applique la transformation à l'iframe
     */
    applyTransform(transform) {
        if (this.isDestroyed || !this.iframe) return;

        const { width, height, scaleX, scaleY, left, top } = transform;

        try {
            // Transformation CSS
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

    /**
     * Log les informations de scaling
     */
    logScalingInfo(scale, viewport) {
        const scalePercent = scale.uniform
            ? `${(scale.x * 100).toFixed(1)}%`
            : `${(scale.x * 100).toFixed(1)}% × ${(scale.y * 100).toFixed(1)}%`;

        const finalSize = scale.uniform
            ? `${Math.round(this.contentW * scale.x)}×${Math.round(this.contentH * scale.y)}`
            : `${Math.round(this.contentW * scale.x)}×${Math.round(this.contentH * scale.y)}`;

        console.log(`🔍 Échelle: ${scalePercent} | ${this.contentW}×${this.contentH} → ${finalSize} | Mode: ${this.config.fillMode}`);
    }

    /**
     * Change le mode de remplissage
     */
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

    /**
     * Force une remesure
     */
    forceUpdate() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler détruit, impossible de forcer la mise à jour');
            return;
        }

        console.log('🔄 Mise à jour forcée du scaling');
        this.isReady = false;
        this.invalidateDocumentCache();
        
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.handleLoad();
            }
        }, this.config.loadDelay);
    }

    /**
     * Récupère les informations de scaling
     */
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

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        if (this.isDestroyed) return;

        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        console.log('⚙️ Configuration scaling mise à jour');

        // Appliquer immédiatement si nécessaire
        const criticalChanges = ['fillMode', 'maxScale', 'minScale', 'centerContent'];
        const shouldReapply = criticalChanges.some(key =>
            newConfig[key] !== undefined && newConfig[key] !== oldConfig[key]
        );

        if (shouldReapply && this.isReady) {
            this.applyScale();
        }
    }

    /**
     * Enregistre une erreur dans le monitoring (sécurisé)
     */
    recordError(error) {
        if (window.healthMonitor && typeof window.healthMonitor.recordError === 'function') {
            try {
                window.healthMonitor.recordError({
                    type: 'scale_handler',
                    message: error?.message || 'Erreur inconnue du gestionnaire de mise à l\'échelle',
                    source: 'ScaleHandler'
                });
            } catch (e) {
                console.warn('Erreur lors de l\'enregistrement dans healthMonitor:', e);
            }
        }
    }

    /**
     * Vérifie l'intégrité du gestionnaire
     */
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

    /**
     * Nettoie les ressources - VERSION AMÉLIORÉE
     */
    cleanup() {
        if (this.isDestroyed) {
            console.warn('⚠️ ScaleHandler déjà détruit');
            return;
        }

        console.log('🧹 Nettoyage ScaleHandler');
        
        // Marquer comme détruit
        this.isDestroyed = true;

        // Nettoyer tous les timeouts
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // Retirer les event listeners
        if (this.boundOnLoad && this.iframe) {
            try {
                this.iframe.removeEventListener('load', this.boundOnLoad);
            } catch (error) {
                console.warn('Erreur lors du nettoyage listener load:', error);
            }
        }
        
        if (this.boundOnResize) {
            try {
                window.removeEventListener('resize', this.boundOnResize);
            } catch (error) {
                console.warn('Erreur lors du nettoyage listener resize:', error);
            }
        }

        // Nettoyer le cache
        this.invalidateDocumentCache();
        
        // Reset des propriétés
        this.isReady = false;
        this.iframe = null;
        this.boundOnLoad = null;
        this.boundOnResize = null;
        this.contentW = 0;
        this.contentH = 0;
        this.config = null;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScaleHandler;
}