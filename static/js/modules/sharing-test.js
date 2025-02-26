import { SharingModule } from './sharing.js';

/**
 * SharingTestModule - Provides testing utilities for the sharing functionality
 * This module is only loaded in development/testing environments
 */
export const SharingTestModule = {
    /**
     * Initialize the test module
     */
    init() {
        console.log('SharingTestModule initialized');
        this.injectTestUI();
    },

    /**
     * Inject a testing UI into the page
     */
    injectTestUI() {
        // Only inject in development/testing environments
        if (!this.isDevelopment()) {
            return;
        }

        // Create test container
        const container = document.createElement('div');
        container.id = 'sharing-test-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            z-index: 9999;
            max-width: 400px;
            display: none;
        `;

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Test Sharing';
        toggleButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #0066ff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            z-index: 10000;
        `;
        toggleButton.onclick = () => {
            const isVisible = container.style.display === 'block';
            container.style.display = isVisible ? 'none' : 'block';
            toggleButton.style.display = isVisible ? 'block' : 'none';
        };

        // Create test UI content
        container.innerHTML = `
            <div class="sharing-test-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px;">Sharing Test Panel</h3>
                <button id="close-sharing-test" style="background: none; border: none; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            
            <div class="sharing-test-content" style="margin-bottom: 16px;">
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">Opportunity Name:</label>
                    <input id="test-opportunity-name" type="text" value="Test Opportunity" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">Country:</label>
                    <input id="test-opportunity-country" type="text" value="Test Country" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">Discipline:</label>
                    <input id="test-opportunity-discipline" type="text" value="Visual Arts, Music" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">Closing Date:</label>
                    <input id="test-opportunity-date" type="text" value="2023-12-31" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">Registration:</label>
                    <select id="test-opportunity-registration" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="Sin cargo">Sin cargo</option>
                        <option value="Con cargo">Con cargo</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 14px;">URL:</label>
                    <input id="test-opportunity-url" type="text" value="https://example.com/test-opportunity" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </div>
            
            <div class="sharing-test-preview" style="margin-bottom: 16px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px;">Preview:</h4>
                <pre id="sharing-preview" style="margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 12px;"></pre>
            </div>
            
            <div class="sharing-test-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
                <button id="test-whatsapp" class="test-share-btn" style="flex: 1; min-width: 100px; padding: 6px; background: #25D366; color: white; border: none; border-radius: 4px; cursor: pointer;">WhatsApp</button>
                <button id="test-twitter" class="test-share-btn" style="flex: 1; min-width: 100px; padding: 6px; background: #1DA1F2; color: white; border: none; border-radius: 4px; cursor: pointer;">Twitter</button>
                <button id="test-linkedin" class="test-share-btn" style="flex: 1; min-width: 100px; padding: 6px; background: #0077B5; color: white; border: none; border-radius: 4px; cursor: pointer;">LinkedIn</button>
                <button id="test-email" class="test-share-btn" style="flex: 1; min-width: 100px; padding: 6px; background: #D44638; color: white; border: none; border-radius: 4px; cursor: pointer;">Email</button>
                <button id="test-copy" class="test-share-btn" style="flex: 1; min-width: 100px; padding: 6px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy</button>
            </div>
        `;

        // Add to document
        document.body.appendChild(container);
        document.body.appendChild(toggleButton);

        // Attach event listeners
        this.attachTestEventListeners(container);
    },

    /**
     * Attach event listeners to the test UI
     * @param {HTMLElement} container - The test UI container
     */
    attachTestEventListeners(container) {
        // Close button
        const closeButton = container.querySelector('#close-sharing-test');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                container.style.display = 'none';
                document.querySelector('#sharing-test-container + button').style.display = 'block';
            });
        }

        // Input change handlers to update preview
        const inputs = container.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updatePreview(container));
        });

        // Initial preview update
        this.updatePreview(container);

        // Share button handlers
        const testWhatsApp = container.querySelector('#test-whatsapp');
        if (testWhatsApp) {
            testWhatsApp.addEventListener('click', () => {
                const opportunity = this.getTestOpportunity(container);
                SharingModule.shareOpportunity(opportunity, 'whatsapp');
            });
        }

        const testTwitter = container.querySelector('#test-twitter');
        if (testTwitter) {
            testTwitter.addEventListener('click', () => {
                const opportunity = this.getTestOpportunity(container);
                SharingModule.shareOpportunity(opportunity, 'twitter');
            });
        }

        const testLinkedIn = container.querySelector('#test-linkedin');
        if (testLinkedIn) {
            testLinkedIn.addEventListener('click', () => {
                const opportunity = this.getTestOpportunity(container);
                SharingModule.shareOpportunity(opportunity, 'linkedin');
            });
        }

        const testEmail = container.querySelector('#test-email');
        if (testEmail) {
            testEmail.addEventListener('click', () => {
                const opportunity = this.getTestOpportunity(container);
                SharingModule.shareOpportunity(opportunity, 'email');
            });
        }

        const testCopy = container.querySelector('#test-copy');
        if (testCopy) {
            testCopy.addEventListener('click', () => {
                const opportunity = this.getTestOpportunity(container);
                SharingModule.shareOpportunity(opportunity, 'copy');
            });
        }
    },

    /**
     * Update the preview based on the current test inputs
     * @param {HTMLElement} container - The test UI container
     */
    updatePreview(container) {
        const opportunity = this.getTestOpportunity(container);
        const previewElement = container.querySelector('#sharing-preview');
        
        if (previewElement) {
            const formattedText = SharingModule.formatOpportunityDetails(opportunity);
            previewElement.textContent = formattedText;
        }
    },

    /**
     * Get the test opportunity data from the UI inputs
     * @param {HTMLElement} container - The test UI container
     * @returns {Object} - The test opportunity data
     */
    getTestOpportunity(container) {
        return {
            id: 'test-' + Date.now(),
            nombre: container.querySelector('#test-opportunity-name').value,
            país: container.querySelector('#test-opportunity-country').value,
            disciplina: container.querySelector('#test-opportunity-discipline').value,
            fecha_de_cierre: container.querySelector('#test-opportunity-date').value,
            inscripcion: container.querySelector('#test-opportunity-registration').value,
            url: container.querySelector('#test-opportunity-url').value
        };
    },

    /**
     * Check if we're in a development environment
     * @returns {Boolean} - Whether we're in development
     */
    isDevelopment() {
        // Check for development indicators
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('.local') ||
            window.location.search.includes('test=true') ||
            localStorage.getItem('enableSharingTest') === 'true'
        );
    }
}; 