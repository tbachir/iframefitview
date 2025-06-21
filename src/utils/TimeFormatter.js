/**
 * Time Formatting Utility
 * Provides consistent time formatting across the application
 */
export class TimeFormatter {
    // Constants for time calculations
    static MILLISECONDS_PER_MINUTE = 60000;
    static MINUTES_PER_HOUR = 60;
    static HOURS_PER_DAY = 24;

    /**
     * Format a date as "time ago" string in French
     * @param {Date} date - The date to format
     * @returns {string} Formatted time ago string
     */
    static formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / this.MILLISECONDS_PER_MINUTE);

        if (diffMinutes < 1) return 'à l\'instant';
        if (diffMinutes < this.MINUTES_PER_HOUR) {
            return `il y a ${diffMinutes}min`;
        }

        const diffHours = Math.floor(diffMinutes / this.MINUTES_PER_HOUR);
        if (diffHours < this.HOURS_PER_DAY) {
            return `il y a ${diffHours}h`;
        }

        const diffDays = Math.floor(diffHours / this.HOURS_PER_DAY);
        return `il y a ${diffDays}j`;
    }

    /**
     * Format a date as time string (HH:MM)
     * @param {Date} date - The date to format
     * @returns {string} Formatted time string or "—" if date is null
     */
    static formatTime(date) {
        return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    }

    /**
     * Format a date as full date and time string
     * @param {Date} date - The date to format
     * @returns {string} Formatted date and time string
     */
    static formatDateTime(date) {
        return date ? date.toLocaleString('fr-FR') : '—';
    }

    /**
     * Get current timestamp in milliseconds
     * @returns {number} Current timestamp
     */
    static now() {
        return Date.now();
    }
}