import { Utils } from '../utils.js';

export const TopModule = {
    currentIndex: 0,
    pages: [],

    init(pages) {
        // Filter only pages where top is true
        this.pages = pages.filter(page => page.top === true);
        this.updateDisplay();
        this.attachNavigationListeners();
    },

    nextPage() {
        if (this.currentIndex + 1 < this.pages.length) {
            this.currentIndex++;
            this.updateDisplay();
        }
    },

    prevPage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateDisplay();
        }
    },

    updateDisplay() {
        const container = document.querySelector('.top-opportunities-container .grid');
        if (!container || !this.pages || !this.pages.length) return;

        // Update navigation buttons state
        const prevButton = document.querySelector('.top-prev');
        const nextButton = document.querySelector('.top-next');
        
        if (prevButton) {
            prevButton.style.opacity = this.currentIndex > 0 ? '1' : '0.5';
            prevButton.style.cursor = this.currentIndex > 0 ? 'pointer' : 'default';
        }
        
        if (nextButton) {
            nextButton.style.opacity = (this.currentIndex + 1) < this.pages.length ? '1' : '0.5';
            nextButton.style.cursor = (this.currentIndex + 1) < this.pages.length ? 'pointer' : 'default';
        }

        const currentPage = this.pages[this.currentIndex];
        if (!currentPage) return;

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden p-6">
                <div class="grid grid-cols-2 gap-8">
                    <!-- Left side: Image placeholder -->
                    <div class="bg-gray-100 rounded-lg flex items-center justify-center">
                        <img src="/static/public/IsoAtx.png" alt="Atlantic x Logo" class="w-full h-48 object-contain p-8">
                    </div>
                    
                    <!-- Right side: Content -->
                    <div class="flex flex-col justify-between">
                        <div>
                            <h3 class="text-xl font-semibold mb-4">${Utils.escapeHTML(currentPage.nombre_original)}</h3>
                            
                            <!-- Meta information -->
                            <div class="space-y-2 mb-4">
                                <div class="flex items-center text-gray-600">
                                    <svg class="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                                    </svg>
                                    ${Utils.escapeHTML(currentPage.país)}
                                </div>
                                
                                <div class="flex items-center text-gray-600">
                                    <svg class="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                                    </svg>
                                    ${Utils.escapeHTML(currentPage.disciplina)}
                                </div>
                                
                                <div class="flex items-center text-gray-600">
                                    <svg class="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                    </svg>
                                    ${currentPage.fecha_de_cierre === '1900-01-01' ? 'Confirmar en bases' : Utils.escapeHTML(currentPage.fecha_de_cierre)}
                                </div>
                            </div>

                            <p class="text-gray-600 text-sm mb-4">${Utils.escapeHTML(currentPage.og_resumida)}</p>
                        </div>

                        <button 
                            type="button"
                            class="preview-btn mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors w-fit"
                            data-url="${Utils.escapeHTML(currentPage.url)}"
                            data-nombre="${Utils.escapeHTML(currentPage.nombre)}"
                            data-pais="${Utils.escapeHTML(currentPage.país)}"
                            data-og-resumida="${Utils.escapeHTML(currentPage.og_resumida)}"
                            data-id="${Utils.escapeHTML(currentPage.id)}"
                            data-categoria="${Utils.escapeHTML(currentPage.categoria)}"
                        >
                            Ver más
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    attachNavigationListeners() {
        const prevButton = document.querySelector('.top-prev');
        const nextButton = document.querySelector('.top-next');

        if (prevButton) {
            prevButton.addEventListener('click', () => this.prevPage());
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => this.nextPage());
        }
    }
}; 