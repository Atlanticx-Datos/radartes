import { Utils } from '../utils.js';

// Handles featured content carousel
export const DestacarModule = {
    currentIndex: 0,
    pages: [],

    init(pages) {
        this.pages = pages;
        this.updateDisplay();
        this.attachNavigationListeners();
    },

    nextPage() {
        if (this.currentIndex + 3 < this.pages.length) {
            this.currentIndex += 3;
            console.log('New index:', this.currentIndex);
            this.updateDisplay();
        }
    },

    prevPage() {
        if (this.currentIndex > 0) {
            this.currentIndex -= 3;
            console.log('New index:', this.currentIndex);
            this.updateDisplay();
        }
    },

    updateDisplay() {
        const container = document.querySelector('.featured-opportunities .grid');
        if (!container || !this.pages || !this.pages.length) return;

        // Function to format date
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr === '1900-01-01') {
                return 'Confirmar en bases';
            }
            try {
                const date = new Date(dateStr);
                const day = String(date.getDate()).padStart(2, '0');
                const year = date.getFullYear();
                const monthMap = {
                    0: 'Ene',
                    1: 'Feb',
                    2: 'Mar',
                    3: 'Abr',
                    4: 'May',
                    5: 'Jun',
                    6: 'Jul',
                    7: 'Ago',
                    8: 'Sep',
                    9: 'Oct',
                    10: 'Nov',
                    11: 'Dic'
                };
                return `${day}/${monthMap[date.getMonth()]}/${year}`;
            } catch (e) {
                return dateStr;
            }
        };

        // Update navigation buttons state (opacity) instead of visibility
        const prevButton = document.querySelector('.destacar-prev');
        const nextButton = document.querySelector('.destacar-next');
        
        if (prevButton) {
            prevButton.style.opacity = this.currentIndex > 0 ? '1' : '0.5';
            prevButton.style.cursor = this.currentIndex > 0 ? 'pointer' : 'default';
        }
        
        if (nextButton) {
            nextButton.style.opacity = (this.currentIndex + 3) < this.pages.length ? '1' : '0.5';
            nextButton.style.cursor = (this.currentIndex + 3) < this.pages.length ? 'pointer' : 'default';
        }

        container.innerHTML = this.pages
            .slice(this.currentIndex, this.currentIndex + 3)
            .map(page => `
                <div class="bg-white rounded-lg shadow-md overflow-hidden relative cursor-pointer opportunity-preview"
                     data-url="${Utils.escapeHTML(page.url)}"
                     data-nombre="${Utils.escapeHTML(page.nombre_original)}"
                     data-country="${Utils.escapeHTML(page.país)}"
                     data-summary="${Utils.escapeHTML(page.og_resumida || '')}"
                     data-id="${Utils.escapeHTML(page.id)}"
                     data-category="${Utils.escapeHTML(page.categoria)}"
                     data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}">
                    <div class="relative h-48 bg-gray-200">
                        <img src="/static/public/IsoAtx.png" alt="Atlantic x Logo" class="w-full h-full object-contain p-4">
                        <span class="absolute top-3 left-3 bg-gray-100 text-sm px-2 py-1 rounded-md">
                            ${Utils.escapeHTML(page.categoria)}
                        </span>
                        <button class="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="p-4">
                        <h3 class="font-medium text-lg mb-2">${Utils.escapeHTML(page.nombre_original)}</h3>
                        
                        <div class="flex flex-wrap gap-4 text-sm text-gray-600 mt-3">
                            <div class="flex items-center gap-1">
                                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                                </svg>
                                <span>${Utils.escapeHTML(page.país)}</span>
                            </div>
                            
                            <div class="flex items-center gap-1">
                                ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                    '<div class="relative inline-block"><svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg><svg class="absolute top-0 left-0 w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="5" x2="19" y2="19"/></svg></div>' : 
                                    '<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg>'
                                }
                            </div>
                            
                            <div class="flex items-center gap-1">
                                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                                </svg>
                                <span>${Utils.escapeHTML(page.disciplina.split(',').slice(0, 2).join(', '))}</span>
                            </div>
                            
                            <div class="flex items-center gap-1">
                                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                </svg>
                                <span>${formatDate(page.fecha_de_cierre)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        // Attach click handlers to the newly created opportunity cards
        container.querySelectorAll('.opportunity-preview').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const dataset = element.dataset;
                
                if (window.ModalModule && window.ModalModule.showPreviewModal) {
                    window.ModalModule.showPreviewModal(
                        dataset.url,
                        dataset.nombre,
                        dataset.country,
                        dataset.summary,
                        dataset.id,
                        dataset.category
                    );
                } else {
                    console.error('ModalModule not found or showPreviewModal not available');
                }
            });
        });
    },

    attachNavigationListeners() {
        const prevButton = document.querySelector('.destacar-prev');
        const nextButton = document.querySelector('.destacar-next');

        if (prevButton) {
            prevButton.addEventListener('click', () => this.prevPage());
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => this.nextPage());
        }
    }
}; 