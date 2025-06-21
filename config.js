/**
 * HuddleBoard Application Configuration
 * @typedef {Object} DisplayConfig
 * @property {string} name - Display name (required)
 * @property {string} slug - URL slug (required, alphanumeric + hyphens)
 * @property {string} path - Relative path to display HTML (required)
 * @property {number} [refreshInterval] - Refresh interval in ms (optional, defaults to global)
 * @property {string} [description] - Display description (optional)
 * @property {boolean} [monitoring=true] - Enable health monitoring (optional)
 */

/**
 * @typedef {Object} AppConfig
 * @property {number} defaultRefreshInterval - Default refresh interval in ms
 * @property {number} [maxConsecutiveErrors=5] - Max errors before slowdown
 * @property {number} [networkTimeout=15000] - Network timeout in ms
 * @property {DisplayConfig[]} displays - Array of display configurations
 */

window.AppConfig = {
    // Intervalle de refresh par défaut en ms (optionnel)
    defaultRefreshInterval: 60000,
    
    // Configuration avancée
    maxConsecutiveErrors: 5,
    networkTimeout: 15000,
    
    displays: [
        {
            name: "Projet",
            slug: "projet",
            path: "./displays/Projet/index.html",
            refreshInterval: 17000,
            description: "Description optionnelle",
            monitoring: true
        },
        {
            name: "OFFLINE 2",
            slug: "offline2",
            path: "./displays/Projet copy/index.html",
            description: "Description optionnelle",
            monitoring: true
        },
        {
            name: "Projet 3",
            slug: "projet-3",
            path: "./displays/Projet copy 3/index.html",
            description: "Description optionnelle",
            monitoring: true
        },
        {
            name: "Projet 4",
            slug: "projet-4",
            path: "./displays/Projet copy 4/index.html",
            description: "Description optionnelle",
            monitoring: true
        },
        {
            name: "Cas styles inline",
            slug: "styles-inline",
            path: "./displays/inline_styles_excel_like/index.html",
            description: "Fichier avec de nombreux styles inline",
            monitoring: true
        },
        {
            name: "Cas texte long",
            slug: "texte-long",
            path: "./displays/long_text_in_cell/index.html",
            description: "Cellule contenant un texte très long, Cellule contenant un texte très long, Cellule contenant un texte très long",
            monitoring: true
        },
        {
            name: "Cas formules visibles",
            slug: "formules-visibles",
            path: "./displays/visible_formulas/index.html",
            description: "Cellules contenant des formules",
            monitoring: true
        },
        {
            name: "Cas tableaux imbriqués",
            slug: "tableaux-imbriques",
            path: "./displays/nested_tables/index.html",
            description: "Tableaux HTML imbriqués",
            monitoring: true
        },
        {
            name: "Cas cellules vides",
            slug: "cellules-vides",
            path: "./displays/empty_cells_with_width/index.html",
            description: "Cellules vides avec largeur définie",
            monitoring: true
        }
    ]
};

/**
 * Configuration Validator
 */
class ConfigValidator {
    static validate(config) {
        const errors = [];
        
        if (!config) {
            errors.push('Configuration object is required');
            return { isValid: false, errors };
        }
        
        if (typeof config.defaultRefreshInterval !== 'number' || config.defaultRefreshInterval < 1000) {
            errors.push('defaultRefreshInterval must be a number >= 1000ms');
        }
        
        if (!Array.isArray(config.displays)) {
            errors.push('displays must be an array');
        } else {
            config.displays.forEach((display, index) => {
                errors.push(...this.validateDisplay(display, index));
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    static validateDisplay(display, index) {
        const errors = [];
        const prefix = `displays[${index}]`;
        
        if (!display || typeof display !== 'object') {
            errors.push(`${prefix} must be an object`);
            return errors;
        }
        
        if (!display.name || typeof display.name !== 'string') {
            errors.push(`${prefix}.name is required and must be a string`);
        }
        
        if (!display.slug || !/^[a-z0-9-]+$/.test(display.slug)) {
            errors.push(`${prefix}.slug must be alphanumeric with hyphens only`);
        }
        
        if (!display.path || typeof display.path !== 'string') {
            errors.push(`${prefix}.path is required and must be a string`);
        }
        
        return errors;
    }
}

// Validate configuration on load
try {
    const validation = ConfigValidator.validate(window.AppConfig);
    if (!validation.isValid) {
        console.error('Configuration validation failed:', validation.errors);
        throw new Error('Invalid configuration: ' + validation.errors.join(', '));
    }
    console.log('✅ Configuration validée avec succès');
} catch (error) {
    console.error('❌ Erreur de configuration:', error);
    // Don't throw here to allow the app to show error page
}