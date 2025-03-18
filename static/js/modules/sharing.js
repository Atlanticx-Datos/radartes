import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';

/**
 * SharingModule - Handles enhanced sharing functionality with brand information
 * and additional opportunity details.
 */
export const SharingModule = {
    // App branding information - can be updated from server config
    brandInfo: {
        name: "Radartes",
        tagline: "Convocatorias, Becas y Recursos Globales para Artistas",
        url: window.location.origin,
        imageUrl: `${window.location.origin}/static/public/Logo_100_mediano.png`
    },

    /**
     * Initialize the sharing module with configuration
     * @param {Object} config - Configuration options
     */
    init(config = {}) {
        // Override default brand info with any provided config
        if (config.brandInfo) {
            this.brandInfo = { ...this.brandInfo, ...config.brandInfo };
        }
        
        // Log initialization for debugging
        console.log('SharingModule initialized with brand info:', this.brandInfo);
        
        // Attach event listeners for share buttons if needed
        this.attachShareListeners();
    },

    /**
     * Attach event listeners to share buttons
     */
    attachShareListeners() {
        // This will be called if we need to attach listeners programmatically
        // For now, we're using onclick handlers in the HTML
    },

    /**
     * Format opportunity details for sharing
     * @param {Object} opportunity - The opportunity data
     * @returns {String} - Formatted text for sharing
     */
    formatOpportunityDetails(opportunity) {
        let details = [];
        
        // Add opportunity name
        if (opportunity.nombre) {
            details.push(`📢 ${opportunity.nombre}`);
        }
        
        // Add bullet points for key details
        if (opportunity.país) {
            details.push(`📍 ${opportunity.país}`);
        }
        
        if (opportunity.disciplina) {
            details.push(`🎨 ${opportunity.disciplina}`);
        }
        
        if (opportunity.fecha_de_cierre) {
            const formattedDate = opportunity.fecha_de_cierre === '1900-01-01' 
                ? 'Confirmar en bases' 
                : opportunity.fecha_de_cierre;
            details.push(`📅 Cierre: ${formattedDate}`);
        }
        
        if (opportunity.inscripcion) {
            const inscripcionIcon = opportunity.inscripcion === 'Sin cargo' ? '✅' : '💰';
            details.push(`${inscripcionIcon} ${opportunity.inscripcion}`);
        }
        
        // Add URL
        if (opportunity.url) {
            details.push(`\n${opportunity.url}`);
        }
        
        // Add brand signature
        details.push(`\nCompartido desde ${this.brandInfo.name}`);
        
        return details.join('\n');
    },

    /**
     * Share opportunity with enhanced details
     * @param {Object} opportunity - The opportunity data
     * @param {String} platform - The platform to share on (whatsapp, twitter, etc.)
     * @returns {Boolean} - Whether the share was initiated
     */
    shareOpportunity(opportunity, platform) {
        // Validate inputs
        if (!opportunity || !platform) {
            console.error('Missing required parameters for sharing:', { opportunity, platform });
            return false;
        }
        
        console.log(`Attempting to share opportunity via ${platform}`, opportunity);
        
        // Format the opportunity details
        const formattedText = this.formatOpportunityDetails(opportunity);
        
        // Track the share attempt for analytics
        this.trackShare(platform, opportunity.id);
        
        // Share based on platform
        try {
            switch (platform.toLowerCase()) {
                case 'whatsapp':
                    return this.shareToWhatsApp(formattedText);
                    
                case 'twitter':
                case 'x':
                    return this.shareToTwitter(opportunity.nombre, opportunity.url);
                    
                case 'linkedin':
                    return this.shareToLinkedIn(opportunity.url);
                    
                case 'facebook':
                    return this.shareToFacebook(opportunity.url);
                    
                case 'email':
                case 'gmail':
                    return this.shareViaEmail(opportunity.nombre, formattedText);
                    
                case 'copy':
                    return this.copyToClipboard(formattedText);
                    
                default:
                    console.error(`Unsupported sharing platform: ${platform}`);
                    return false;
            }
        } catch (error) {
            console.error(`Error sharing to ${platform}:`, error);
            return false;
        }
    },

    /**
     * Share to WhatsApp
     * @param {String} text - The text to share
     * @returns {Boolean} - Whether the share was initiated
     */
    shareToWhatsApp(text) {
        try {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            return true;
        } catch (error) {
            console.error('Error sharing to WhatsApp:', error);
            return false;
        }
    },

    /**
     * Share to Twitter/X
     * @param {String} title - The title/text to share
     * @param {String} url - The URL to share
     * @returns {Boolean} - Whether the share was initiated
     */
    shareToTwitter(title, url) {
        try {
            const text = `${title} - via ${this.brandInfo.name}`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            return true;
        } catch (error) {
            console.error('Error sharing to Twitter:', error);
            return false;
        }
    },

    /**
     * Share to LinkedIn
     * @param {String} url - The URL to share
     * @returns {Boolean} - Whether the share was initiated
     */
    shareToLinkedIn(url) {
        try {
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
            return true;
        } catch (error) {
            console.error('Error sharing to LinkedIn:', error);
            return false;
        }
    },

    /**
     * Share to Facebook
     * @param {String} url - The URL to share
     * @returns {Boolean} - Whether the share was initiated
     */
    shareToFacebook(url) {
        try {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
            return true;
        } catch (error) {
            console.error('Error sharing to Facebook:', error);
            return false;
        }
    },

    /**
     * Share via email
     * @param {String} subject - The email subject
     * @param {String} body - The email body
     * @returns {Boolean} - Whether the share was initiated
     */
    shareViaEmail(subject, body) {
        try {
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            return true;
        } catch (error) {
            console.error('Error sharing via email:', error);
            return false;
        }
    },

    /**
     * Copy text to clipboard
     * @param {String} text - The text to copy
     * @returns {Boolean} - Whether the copy was successful
     */
    copyToClipboard(text) {
        try {
            // Use the Clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        Utils.showAlert('Contenido copiado al portapapeles');
                    })
                    .catch(err => {
                        console.error('Error copying to clipboard:', err);
                        Utils.showAlert('Error al copiar al portapapeles', 'error');
                        this.fallbackCopyToClipboard(text);
                    });
                return true;
            } else {
                // Fall back to the older approach
                return this.fallbackCopyToClipboard(text);
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            return false;
        }
    },

    /**
     * Fallback method to copy text to clipboard
     * @param {String} text - The text to copy
     * @returns {Boolean} - Whether the copy was successful
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                Utils.showAlert('Contenido copiado al portapapeles');
                return true;
            } else {
                Utils.showAlert('Error al copiar al portapapeles', 'error');
                return false;
            }
        } catch (error) {
            console.error('Fallback error copying to clipboard:', error);
            Utils.showAlert('Error al copiar al portapapeles', 'error');
            return false;
        }
    },

    /**
     * Track sharing events for analytics
     * @param {String} platform - The platform shared to
     * @param {String} opportunityId - The ID of the shared opportunity
     */
    trackShare(platform, opportunityId) {
        // If we have analytics, track the share event
        if (window.gtag) {
            window.gtag('event', 'share', {
                method: platform,
                content_type: 'opportunity',
                content_id: opportunityId
            });
        }
        
        // Log for debugging
        console.log(`Shared opportunity ${opportunityId} to ${platform}`);
    },

    /**
     * Test sharing functionality
     * This can be called from the console to test sharing features
     */
    testSharing() {
        const testOpportunity = {
            id: 'test-123',
            nombre: 'Test Opportunity',
            país: 'Test Country',
            disciplina: 'Visual Arts, Music',
            fecha_de_cierre: '2023-12-31',
            inscripcion: 'Sin cargo',
            url: 'https://example.com/test-opportunity'
        };
        
        console.log('Test opportunity:', testOpportunity);
        console.log('Formatted text:', this.formatOpportunityDetails(testOpportunity));
        
        return {
            opportunity: testOpportunity,
            formattedText: this.formatOpportunityDetails(testOpportunity),
            shareToWhatsApp: () => this.shareToWhatsApp(this.formatOpportunityDetails(testOpportunity)),
            shareToTwitter: () => this.shareToTwitter(testOpportunity.nombre, testOpportunity.url),
            shareToLinkedIn: () => this.shareToLinkedIn(testOpportunity.url),
            shareViaEmail: () => this.shareViaEmail(testOpportunity.nombre, this.formatOpportunityDetails(testOpportunity)),
            copyToClipboard: () => this.copyToClipboard(this.formatOpportunityDetails(testOpportunity))
        };
    }
}; 