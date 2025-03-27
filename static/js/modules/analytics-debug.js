/**
 * analytics-debug.js - Debug utility for analytics
 * 
 * Helps developers monitor analytics events during development
 * Intercepts Google Analytics calls and logs them to the console
 */

export const AnalyticsDebugModule = {
    /**
     * Initialize the debug module
     */
    init() {
        console.log('Analytics Debug module initialized');
        
        if (this.isDevelopmentEnvironment()) {
            this.setupInterceptor();
        }
    },

    /**
     * Check if we're in a development environment
     * @returns {boolean} True if in development
     */
    isDevelopmentEnvironment() {
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true')
        );
    },

    /**
     * Setup analytics interceptor
     */
    setupInterceptor() {
        // Store original gtag function
        const originalGtag = window.gtag;

        // Override gtag to intercept calls
        window.gtag = (...args) => {
            // Log to console
            console.log('%c Analytics Event Tracked:', 'background: #6232FF; color: white; padding: 2px 5px; border-radius: 3px;', {
                event: args[0],
                params: args.slice(1)
            });
            
            // Still call the original function
            if (typeof originalGtag === 'function') {
                originalGtag(...args);
            }
        };

        // Also intercept our custom tracking function
        const originalTrackEvent = window.trackOpportunityEvent;
        window.trackOpportunityEvent = (eventName, opportunityData) => {
            // Log to console
            console.log('%c Opportunity Event Tracked:', 'background: #6232FF; color: white; padding: 2px 5px; border-radius: 3px;', {
                eventName,
                opportunityData
            });
            
            // Still call the original function
            if (typeof originalTrackEvent === 'function') {
                originalTrackEvent(eventName, opportunityData);
            }
        };

        // Add a debug button for manual testing
        this.addDebugPanel();
    },

    /**
     * Add debug panel to the page
     */
    addDebugPanel() {
        const debugBtn = document.createElement('button');
        debugBtn.innerText = 'Analytics Debug';
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9999;
            background: #6232FF;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0.7;
        `;
        
        debugBtn.addEventListener('click', () => {
            this.showDebugPanel();
        });
        
        document.body.appendChild(debugBtn);
    },

    /**
     * Show debug panel with tracking information
     */
    showDebugPanel() {
        // Create panel if it doesn't exist
        if (!this.debugPanel) {
            this.debugPanel = document.createElement('div');
            this.debugPanel.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 15px;
                width: 400px;
                max-width: 90vw;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                font-family: monospace;
                font-size: 12px;
            `;
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerText = 'Close';
            closeBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                font-size: 12px;
                cursor: pointer;
                color: #666;
            `;
            closeBtn.addEventListener('click', () => {
                this.debugPanel.style.display = 'none';
            });
            
            this.debugPanel.appendChild(closeBtn);
            
            // Add title
            const title = document.createElement('h3');
            title.innerText = 'Analytics Debug Panel';
            title.style.cssText = `
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 14px;
                font-weight: bold;
            `;
            this.debugPanel.appendChild(title);
            
            // Add test buttons
            const testBtnContainer = document.createElement('div');
            testBtnContainer.style.cssText = `
                display: flex;
                gap: 5px;
                margin-bottom: 15px;
            `;
            
            const testBtn = document.createElement('button');
            testBtn.innerText = 'Test Event';
            testBtn.style.cssText = `
                background: #6232FF;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
                cursor: pointer;
            `;
            testBtn.addEventListener('click', () => {
                if (typeof window.trackOpportunityEvent === 'function') {
                    window.trackOpportunityEvent('test_event', {
                        name: 'Test Opportunity',
                        country: 'Test Country',
                        discipline: 'Test Discipline',
                        id: 'test-123'
                    });
                } else if (typeof gtag === 'function') {
                    gtag('event', 'test_event', {
                        'event_category': 'Test',
                        'event_label': 'Manual Test'
                    });
                }
            });
            
            testBtnContainer.appendChild(testBtn);
            this.debugPanel.appendChild(testBtnContainer);
            
            // Add content container for logs
            this.logsContainer = document.createElement('div');
            this.logsContainer.style.cssText = `
                border-top: 1px solid #eee;
                padding-top: 10px;
                max-height: 500px;
                overflow-y: auto;
            `;
            this.debugPanel.appendChild(this.logsContainer);
            
            document.body.appendChild(this.debugPanel);
        }
        
        // Show panel and update info
        this.debugPanel.style.display = 'block';
        this.updateDebugInfo();
    },

    /**
     * Update debug panel information
     */
    updateDebugInfo() {
        if (!this.logsContainer) return;
        
        this.logsContainer.innerHTML = '';
        
        // Add info about what to track
        const trackingInfo = document.createElement('div');
        trackingInfo.innerHTML = `
            <p><strong>Tracking Info:</strong></p>
            <ul>
                <li>Tracking Opportunity Clicks: name, country, first discipline</li>
                <li>Tracking "Ver oportunidad" button clicks in modals</li>
            </ul>
            <p><strong>Events will appear here when triggered:</strong></p>
        `;
        
        this.logsContainer.appendChild(trackingInfo);
    }
};

export default AnalyticsDebugModule; 