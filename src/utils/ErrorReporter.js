/**
 * Centralized Error Reporting Utility
 * Provides consistent error reporting across the application
 */
class ErrorReporter {
    constructor(healthMonitor = null) {
        this.healthMonitor = healthMonitor || window.healthMonitor;
        this.fallbackLogger = console;
    }

    /**
     * Reports an error with context information
     * @param {Error|string} error - The error to report
     * @param {Object} context - Additional context information
     * @param {string} context.type - Error type/category
     * @param {string} context.source - Source component/class
     * @param {Object} context.metadata - Additional metadata
     */
    report(error, context = {}) {
        const errorData = this.formatError(error, context);
        
        // Try health monitor first
        if (this.tryHealthMonitorReport(errorData)) {
            return;
        }
        
        // Fallback to console logging
        this.fallbackReport(errorData);
    }

    /**
     * Reports a warning (non-critical error)
     */
    reportWarning(message, context = {}) {
        this.report(new Error(message), {
            ...context,
            severity: 'warning'
        });
    }

    /**
     * Reports an info message
     */
    reportInfo(message, context = {}) {
        this.report(new Error(message), {
            ...context,
            severity: 'info'
        });
    }

    /**
     * Formats error data consistently
     * @private
     */
    formatError(error, context) {
        const timestamp = Date.now();
        const errorMessage = error?.message || String(error) || 'Unknown error';
        
        return {
            type: context.type || 'unknown',
            message: errorMessage,
            source: context.source || 'Unknown',
            severity: context.severity || 'error',
            timestamp,
            stack: error?.stack,
            metadata: context.metadata || {},
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }

    /**
     * Attempts to report via health monitor
     * @private
     */
    tryHealthMonitorReport(errorData) {
        if (!this.healthMonitor?.recordError) {
            return false;
        }

        try {
            this.healthMonitor.recordError(errorData);
            return true;
        } catch (e) {
            this.fallbackLogger.warn('Health monitor error reporting failed:', e);
            return false;
        }
    }

    /**
     * Fallback error reporting to console
     * @private
     */
    fallbackReport(errorData) {
        const logMethod = this.getLogMethod(errorData.severity);
        logMethod(`[${errorData.source}] ${errorData.message}`, errorData);
    }

    /**
     * Gets appropriate console method based on severity
     * @private
     */
    getLogMethod(severity) {
        switch (severity) {
            case 'warning': return this.fallbackLogger.warn.bind(this.fallbackLogger);
            case 'info': return this.fallbackLogger.info.bind(this.fallbackLogger);
            case 'error':
            default: return this.fallbackLogger.error.bind(this.fallbackLogger);
        }
    }

    /**
     * Updates the health monitor reference
     */
    setHealthMonitor(healthMonitor) {
        this.healthMonitor = healthMonitor;
    }

    /**
     * Creates a bound reporter for a specific source
     */
    createSourceReporter(source) {
        return {
            report: (error, context = {}) => this.report(error, { ...context, source }),
            reportWarning: (message, context = {}) => this.reportWarning(message, { ...context, source }),
            reportInfo: (message, context = {}) => this.reportInfo(message, { ...context, source })
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorReporter;
}

// Global instance for immediate usage
window.ErrorReporter = ErrorReporter;