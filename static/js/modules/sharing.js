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
     * @param {String} platform - The platform to share on
     * @returns {String} - Formatted text for sharing
     */
    formatOpportunityDetails(opportunity, platform = '') {
        let details = [];
        
        // For WhatsApp, use simpler format with plain text instead of emojis
        const isWhatsApp = platform.toLowerCase() === 'whatsapp';
        
        // Add opportunity name
        if (opportunity.nombre) {
            details.push(isWhatsApp ? `${opportunity.nombre}` : `📢 ${opportunity.nombre}`);
        }
        
        // Add bullet points for key details
        if (opportunity.país) {
            details.push(isWhatsApp ? `País: ${opportunity.país}` : `📍 ${opportunity.país}`);
        }
        
        if (opportunity.disciplina) {
            details.push(isWhatsApp ? `Disciplina: ${opportunity.disciplina}` : `🎨 ${opportunity.disciplina}`);
        }
        
        if (opportunity.fecha_de_cierre) {
            const formattedDate = opportunity.fecha_de_cierre === '1900-01-01' || opportunity.fecha_de_cierre === 'Confirmar en bases'
                ? 'Confirmar en bases' 
                : opportunity.fecha_de_cierre;
            details.push(isWhatsApp ? `Cierre: ${formattedDate}` : `📅 Cierre: ${formattedDate}`);
        }
        
        if (opportunity.inscripcion) {
            const inscripcionIcon = opportunity.inscripcion === 'Sin cargo' ? '✅' : '💰';
            details.push(isWhatsApp ? `Inscripción: ${opportunity.inscripcion}` : `${inscripcionIcon} ${opportunity.inscripcion}`);
        }
        
        // Add a brief description if available
        if (opportunity.descripcion && opportunity.descripcion.length > 0) {
            // Truncate description if it's too long
            const maxLength = 100;
            const truncatedDescription = opportunity.descripcion.length > maxLength 
                ? opportunity.descripcion.substring(0, maxLength) + '...' 
                : opportunity.descripcion;
            details.push(`\n${truncatedDescription}`);
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
            console.error('Missing required parameters for sharing');
            return false;
        }
        
        // Track the share attempt for analytics
        this.trackShare(platform, opportunity.id);
        
        // Share based on platform
        switch (platform.toLowerCase()) {
            case 'whatsapp':
                // Format the opportunity details specifically for WhatsApp
                const whatsappText = this.formatOpportunityDetails(opportunity, 'whatsapp');
                return this.shareToWhatsApp(whatsappText);
                
            case 'twitter':
            case 'x':
                return this.shareToTwitter(opportunity.nombre, opportunity.url);
                
            case 'linkedin':
                // Create a summary for LinkedIn
                const summary = `${opportunity.país} | ${opportunity.disciplina} | Cierre: ${opportunity.fecha_de_cierre || 'Confirmar en bases'}`;
                return this.shareToLinkedIn(opportunity.url, opportunity.nombre, summary);
                
            case 'facebook':
                return this.shareToFacebook(opportunity.url);
                
            case 'email':
            case 'gmail':
                // Format the opportunity details for email
                const emailText = this.formatOpportunityDetails(opportunity, 'email');
                return this.shareViaEmail(opportunity.nombre, emailText);
                
            case 'copy':
                // For copy, just copy the URL instead of the formatted text
                return this.copyToClipboard(opportunity.url);
                
            default:
                console.error(`Unsupported sharing platform: ${platform}`);
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
            // Use a simpler approach for WhatsApp sharing
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
     * @param {String} title - The title/text to share
     * @param {String} summary - The summary text to share
     * @returns {Boolean} - Whether the share was initiated
     */
    shareToLinkedIn(url, title = '', summary = '') {
        try {
            // LinkedIn sharing API allows for title and summary parameters
            let linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            
            // Add title and summary if provided
            if (title) {
                linkedInUrl += `&title=${encodeURIComponent(title)}`;
            }
            
            if (summary) {
                linkedInUrl += `&summary=${encodeURIComponent(summary)}`;
            }
            
            window.open(linkedInUrl, '_blank');
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
     * This can be called from the browser console to test all sharing methods
     * 
     * Usage:
     * 1. Open browser console (F12 or Ctrl+Shift+I)
     * 2. Type: SharingModule.testSharing()
     * 3. Use the returned object to test specific sharing methods, e.g.:
     *    - SharingModule.testSharing().shareToWhatsApp()
     *    - SharingModule.testSharing().shareToTwitter()
     *    - SharingModule.testSharing().shareToLinkedIn()
     *    - SharingModule.testSharing().shareViaEmail()
     *    - SharingModule.testSharing().copyToClipboard()
     * 
     * @returns {Object} - Object with test methods for each sharing platform
     */
    testSharing() {
        const testOpportunity = {
            id: 'test-123',
            nombre: 'Test Opportunity',
            país: 'Test Country',
            disciplina: 'Visual Arts, Music',
            fecha_de_cierre: '2023-12-31',
            inscripcion: 'Sin cargo',
            url: 'https://example.com/test-opportunity',
            descripcion: 'This is a test opportunity to verify sharing functionality.'
        };
        
        console.log('Test opportunity:', testOpportunity);
        console.log('Formatted text:', this.formatOpportunityDetails(testOpportunity));
        console.log('WhatsApp formatted text:', this.formatOpportunityDetails(testOpportunity, 'whatsapp'));
        
        return {
            opportunity: testOpportunity,
            formattedText: this.formatOpportunityDetails(testOpportunity),
            whatsappText: this.formatOpportunityDetails(testOpportunity, 'whatsapp'),
            shareToWhatsApp: () => this.shareToWhatsApp(this.formatOpportunityDetails(testOpportunity, 'whatsapp')),
            shareToTwitter: () => this.shareToTwitter(testOpportunity.nombre, testOpportunity.url),
            shareToLinkedIn: () => this.shareToLinkedIn(testOpportunity.url, testOpportunity.nombre, `${testOpportunity.país} | ${testOpportunity.disciplina} | Cierre: ${testOpportunity.fecha_de_cierre}`),
            shareViaEmail: () => this.shareViaEmail(testOpportunity.nombre, this.formatOpportunityDetails(testOpportunity, 'email')),
            copyToClipboard: () => this.copyToClipboard(testOpportunity.url)
        };
    }
}; 