/**
 * Event Management Utility
 * Provides centralized event listener management with automatic cleanup
 */
export class EventManager {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Add an event listener and track it for cleanup
     * @param {Element} element - DOM element to attach listener to
     * @param {string} event - Event type (e.g., 'click', 'load')
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     */
    add(element, event, handler, options = {}) {
        const key = this.createKey(element, event, handler);
        element.addEventListener(event, handler, options);
        this.listeners.set(key, { element, event, handler, options });
    }

    /**
     * Remove a specific event listener
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     */
    remove(element, event, handler) {
        const key = this.createKey(element, event, handler);
        const listener = this.listeners.get(key);
        if (listener) {
            element.removeEventListener(event, handler);
            this.listeners.delete(key);
        }
    }

    /**
     * Remove all tracked event listeners
     */
    removeAll() {
        for (const [key, listener] of this.listeners) {
            listener.element.removeEventListener(listener.event, listener.handler);
        }
        this.listeners.clear();
    }

    /**
     * Create a unique key for tracking listeners
     * @private
     */
    createKey(element, event, handler) {
        return `${element.tagName || 'unknown'}_${event}_${handler.name || 'anonymous'}`;
    }

    /**
     * Get the number of tracked listeners
     */
    getListenerCount() {
        return this.listeners.size;
    }
}