import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';

// Handles modal functionality
export const ModalModule = {
    showPreviewModal(url, name, country, summary, id) {
        const modalId = "modal-" + Date.now();

        // Create an overlay element to darken the background and capture clicks
        const overlay = document.createElement("div");
        overlay.id = modalId + "-overlay";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
            z-index: 50;
            opacity: 0;
            transition: opacity 300ms ease-out;
        `;

        // Create the modal container with responsive styling
        const modalContent = document.createElement("div");
        modalContent.id = modalId;
        modalContent.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -45%);
            z-index: 51;
            opacity: 0;
            transition: opacity 300ms ease-out, transform 300ms ease-out;
            width: 90%;
            max-width: 500px;
        `;

        modalContent.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <!-- Header: Title & Share Button -->
                <div class="p-4 border-b flex items-start">
                    <div class="w-2/3">
                        <h3 class="text-xl font-semibold text-gray-800 break-words">
                            ${Utils.escapeHTML(name)}
                        </h3>
                    </div>
                    <div class="w-1/3 relative flex justify-end">
                        <button type="button" class="share-toggle-btn inline-flex items-center px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
                            <span>Compartir</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <div class="share-dropdown hidden absolute right-0 top-full mt-1 w-40 bg-white border rounded-md shadow-lg z-50">
                            <button class="share-option w-full text-left px-4 py-2 hover:bg-gray-100" data-action="copy-url">
                                Copiar URL
                            </button>
                            <a href="#" class="share-option block px-4 py-2 hover:bg-gray-100" data-action="whatsapp">
                                WhatsApp
                            </a>
                            <a href="#" class="share-option block px-4 py-2 hover:bg-gray-100" data-action="twitter">
                                Twitter
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Content -->
                <div class="p-4">
                    <div class="flex items-center text-sm text-gray-600 mb-4">
                        <svg class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                        </svg>
                        ${Utils.escapeHTML(country)}
                    </div>
                    <p class="text-gray-600">${Utils.escapeHTML(summary)}</p>
                </div>

                <!-- Footer -->
                <div class="p-4 bg-gray-50 border-t">
                    <a href="${Utils.escapeHTML(url)}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                        Ver oportunidad completa
                    </a>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(overlay);
        document.body.appendChild(modalContent);

        // Force reflow to enable transitions
        overlay.offsetHeight;
        modalContent.offsetHeight;

        // Show with transitions
        overlay.style.opacity = "1";
        modalContent.style.opacity = "1";
        modalContent.style.transform = "translate(-50%, -50%)";

        // Setup close functionality
        const closeModal = () => {
            overlay.style.opacity = "0";
            modalContent.style.opacity = "0";
            modalContent.style.transform = "translate(-50%, -45%)";
            setTimeout(() => {
                overlay.remove();
                modalContent.remove();
            }, 300);
        };

        overlay.addEventListener('click', closeModal);

        // Setup share functionality
        const shareToggle = modalContent.querySelector('.share-toggle-btn');
        const shareDropdown = modalContent.querySelector('.share-dropdown');
        
        if (shareToggle && shareDropdown) {
            shareToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                shareDropdown.classList.toggle('hidden');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                shareDropdown.classList.add('hidden');
            });

            // Prevent dropdown from closing when clicking inside it
            shareDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Handle share options
            shareDropdown.querySelectorAll('.share-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = option.dataset.action;
                    this.handleShare(action, url, name);
                    shareDropdown.classList.add('hidden');
                });
            });
        }
    },

    handleShare(platform, url, title) {
        switch (platform) {
            case 'copy-url':
                navigator.clipboard.writeText(url).then(() => {
                    Utils.showAlert('URL copiada al portapapeles');
                }).catch(err => {
                    console.error('Error copying URL:', err);
                    Utils.showAlert('Error al copiar URL', 'error');
                });
                break;

            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, '_blank');
                break;

            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
        }
    }
}; 