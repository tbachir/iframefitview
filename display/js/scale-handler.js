/**
 * Scale Handler - Gestionnaire de mise à l'échelle universel
 * Adapte automatiquement la taille du contenu iframe à toutes les résolutions
 */
class ScaleHandler {
    constructor(iframe) {
        this.iframe = iframe;
        this.contentW = window.innerWidth;
        this.contentH = window.innerHeight;
        this.resizeTimeout = null;
        this.loadHandler = null;
        this.resizeHandler = null;
        this.isReady = false;
        
        this.config = {
            loadDelay: 150,              // Délai avant mesure du contenu
            resizeDebounce: 100,         // Debounce pour le resize
            minScale: 0.1,               // Échelle minimale
            maxScale: 50.0,              // Échelle maximale (sans limite pratique)
            centerContent: true,         // Centrer le contenu
            fillMode: 'contain'          // 'contain', 'cover', 'fill', 'fit-width', 'fit-height'
        };

        this.init();
    }

    /**
     * Initialise les gestionnaires d'événements
     */
    init() {
        this.setupLoadHandler();
        this.setupResizeHandler();
    }

    /**
     * Configure le gestionnaire de chargement
     */
    setupLoadHandler() {
        this.loadHandler = () => {
            setTimeout(() => this.onLoad(), this.config.loadDelay);
        };
        
        this.iframe.addEventListener('load', this.loadHandler);
    }

    /**
     * Configure le gestionnaire de redimensionnement
     */
    setupResizeHandler() {
        this.resizeHandler = () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                if (this.isReady) {
                    this.applyScale();
                }
            }, this.config.resizeDebounce);
        };
        
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Gestionnaire de chargement de l'iframe
     */
    onLoad() {
        try {
            const doc = this.iframe.contentDocument;
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
            console.error('❌ Erreur dans onLoad:', e);
            if (window.healthMonitor) {
                window.healthMonitor.recordError(e);
            }
        }
    }

    /**
     * Injecte les styles nécessaires dans l'iframe
     */
    injectStyles(doc) {
        // Vérifier si les styles sont déjà injectés
        if (doc.getElementById('huddleboard-scale-styles')) {
            return;
        }

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
    }

    /**
     * Mesure les dimensions du contenu
     */
    measureContent(doc) {
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
    }

    /**
     * Applique la mise à l'échelle
     */
    applyScale() {
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
            if (window.healthMonitor) {
                window.healthMonitor.recordError(e);
            }
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
        const { width, height, scaleX, scaleY, left, top } = transform;
        
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
        console.log('🔄 Mise à jour forcée du scaling');
        this.isReady = false;
        setTimeout(() => this.onLoad(), this.config.loadDelay);
    }

    /**
     * Récupère les informations de scaling
     */
    getScaleInfo() {
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
            isReady: this.isReady
        };
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
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
     * Nettoie les ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage ScaleHandler');
        
        if (this.loadHandler && this.iframe) {
            this.iframe.removeEventListener('load', this.loadHandler);
            this.loadHandler = null;
        }
        
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        this.isReady = false;
        this.iframe = null;
    }
}

// Export pour usage en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScaleHandler;
}