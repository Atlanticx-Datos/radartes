/**
 * analytics.js - Analytics tracking module
 * 
 * Handles all analytics tracking for the site, focusing on:
 * 1. Opportunity clicks (with name, country, and first discipline)
 * 2. "Ver oportunidad" button clicks in opportunity modals
 */

export const AnalyticsModule = {
    /**
     * Initialize the analytics module
     */
    init() {
        console.log('Analytics module initialized');
        
        // Setup opportunity tracking
        this.setupOpportunityTracking();
    },

    /**
     * Track an event to Google Analytics
     * 
     * @param {string} eventName - Name of the event to track
     * @param {Object} opportunityData - Data about the opportunity
     * @param {string} opportunityData.name - Opportunity name
     * @param {string} opportunityData.country - Opportunity country
     * @param {string} opportunityData.discipline - First discipline of the opportunity
     * @param {string} opportunityData.id - Opportunity ID
     */
    trackEvent(eventName, opportunityData) {
        // Use the global tracking function if available
        if (typeof window.trackOpportunityEvent === 'function') {
            window.trackOpportunityEvent(eventName, opportunityData);
        } else {
            // Fallback if the global function isn't defined
            if (typeof gtag === 'function') {
                gtag('event', eventName, {
                    'event_category': 'Opportunity',
                    'event_label': opportunityData.name || 'Unknown',
                    'opportunity_name': opportunityData.name || 'Unknown',
                    'opportunity_country': opportunityData.country || 'Unknown',
                    'opportunity_discipline': opportunityData.discipline || 'Unknown',
                    'opportunity_id': opportunityData.id || ''
                });
            }
            console.log(`Analytics: Tracked ${eventName} for "${opportunityData.name}"`);
        }
    },

    /**
     * Setup event listeners for tracking opportunity interactions
     */
    setupOpportunityTracking() {
        document.addEventListener('click', (e) => {
            // Track opportunity card clicks
            this.trackOpportunityCardClick(e);
            
            // Track "Ver oportunidad" button clicks
            this.trackVerOpportunidadClick(e);
        });
    },

    /**
     * Track clicks on opportunity cards
     * 
     * @param {Event} e - Click event
     */
    trackOpportunityCardClick(e) {
        const opportunityCard = e.target.closest('.opportunity-card, .preview-btn, .action-button');
        
        if (opportunityCard) {
            const id = opportunityCard.dataset.id;
            const name = opportunityCard.dataset.name || opportunityCard.getAttribute('data-nombre') || 'Unknown';
            const country = opportunityCard.dataset.country || opportunityCard.getAttribute('data-pais') || 'Unknown';
            const discipline = opportunityCard.dataset.discipline || opportunityCard.getAttribute('data-disciplina') || 'Unknown';
            
            // First discipline if multiple are present
            const firstDiscipline = discipline.split(',')[0].trim();
            
            // Track click event
            this.trackEvent('opportunity_click', {
                id: id,
                name: name,
                country: country,
                discipline: firstDiscipline
            });
        }
    },

    /**
     * Track clicks on "Ver oportunidad" buttons in modals
     * 
     * @param {Event} e - Click event
     */
    trackVerOpportunidadClick(e) {
        const verOpportunidadBtn = e.target.closest('.link-btn, .ver-oportunidad-btn');
        
        if (verOpportunidadBtn) {
            // Find the modal container
            const modal = verOpportunidadBtn.closest('.opportunity-modal-content, .modal-content');
            
            if (modal) {
                const opportunityName = modal.querySelector('.opportunity-title, .modal-title')?.textContent || 
                                        modal.dataset.title || 'Unknown';
                const opportunityCountry = modal.dataset.pais || modal.getAttribute('data-country') || 'Unknown';
                const opportunityDiscipline = modal.dataset.disciplina || modal.getAttribute('data-discipline') || 'Unknown';
                const opportunityId = modal.dataset.id || '';
                
                // First discipline if multiple are present
                const firstDiscipline = opportunityDiscipline.split(',')[0].trim();
                
                // Track external link click event
                this.trackEvent('ver_oportunidad_click', {
                    id: opportunityId,
                    name: opportunityName,
                    country: opportunityCountry,
                    discipline: firstDiscipline
                });
            }
        }
    }
};

export default AnalyticsModule; 