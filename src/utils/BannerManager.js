/**
 * Unified Banner Management System
 * Provides centralized banner creation and management
 */
export class BannerManager {
    constructor() {
        this.activeBanners = new Map();
        this.elementCache = new Map();
        this.templates = {
            status: { 
                class: 'status-banner bottom-left',
                template: (data) => `
                    <div class="status-indicator ${data.statusClass}"></div>
                    <div class="status-text">
                        <div class="status-primary">${data.statusText}</div>
                        <div class="status-secondary">${data.secondaryText}</div>
                    </div>
                `
            },
            modif: {
                class: 'modif-banner bottom-right',
                template: (data) => `
                    <svg class="modif-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                    </svg>
                    <div class="modif-text">
                        <div class="modif-primary">Synchronisé</div>
                        <div class="modif-time">${data.timeAgo}</div>
                    </div>
                `
            },
            loading: {
                class: 'loading-banner bottom-right',
                template: (data) => `
                    <div class="loading-spinner"></div>
                    <span>${data.message}</span>
                `
            },
            error: {
                class: 'error-banner bottom-right',
                template: (data) => `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <span>${data.message}</span>
                `
            },
            warning: {
                class: 'warning-banner bottom-right',
                template: (data) => `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <span>${data.message}</span>
                `
            }
        };
    }

    /**
     * Show a banner with specified type and data
     * @param {string} type - Banner type (status, modif, loading, error, warning)
     * @param {Object} data - Data for banner template
     * @param {Object} options - Banner options (id, duration)
     * @returns {Element} Banner element
     */
    show(type, data, options = {}) {
        const template = this.templates[type];
        if (!template) {
            console.warn(`Unknown banner type: ${type}`);
            return null;
        }

        const bannerId = options.id || `${type}-banner`;
        const element = this.getOrCreateElement(bannerId, template.class);
        element.innerHTML = template.template(data);

        this.activeBanners.set(bannerId, {
            element,
            type,
            timer: options.duration > 0 ? 
                setTimeout(() => this.hide(bannerId), options.duration) : null
        });

        return element;
    }

    /**
     * Hide a banner by ID
     * @param {string} bannerId - Banner ID to hide
     */
    hide(bannerId) {
        const banner = this.activeBanners.get(bannerId);
        if (banner) {
            if (banner.timer) clearTimeout(banner.timer);
            banner.element.remove();
            this.activeBanners.delete(bannerId);
            this.elementCache.delete(bannerId);
        }
    }

    /**
     * Update banner content without recreating it
     * @param {string} bannerId - Banner ID to update
     * @param {Object} data - New data for banner template
     */
    update(bannerId, data) {
        const banner = this.activeBanners.get(bannerId);
        if (banner) {
            const template = this.templates[banner.type];
            banner.element.innerHTML = template.template(data);
        }
    }

    /**
     * Get or create a banner element
     * @private
     */
    getOrCreateElement(id, className) {
        let element = this.elementCache.get(id);
        if (!element || !document.body.contains(element)) {
            element = document.createElement('div');
            element.id = id;
            element.className = `banner ${className}`;
            document.body.appendChild(element);
            this.elementCache.set(id, element);
        }
        return element;
    }

    /**
     * Clean up all banners
     */
    cleanup() {
        for (const [bannerId, banner] of this.activeBanners) {
            if (banner.timer) clearTimeout(banner.timer);
            banner.element.remove();
        }
        this.activeBanners.clear();
        this.elementCache.clear();
    }

    /**
     * Get count of active banners
     * @returns {number} Number of active banners
     */
    getActiveCount() {
        return this.activeBanners.size;
    }
}