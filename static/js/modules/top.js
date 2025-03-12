import { Utils } from '../utils.js';

export const TopModule = {
    currentIndex: 0,
    pages: [],

    init(pages) {
        // Filter pages where top is true (accept both boolean true and string "true")
        this.pages = pages.filter(page => page.top === true || page.top === "true");
        
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

        // Get discipline class for styling
        const disciplineClass = this.getDisciplineClass(currentPage.disciplina);
        
        // Format date
        const formattedDate = this.formatDate(currentPage.fecha_de_cierre);
        
        // Extract category and name
        let category = currentPage.categoria || '';
        
        // Extract the title using our helper function
        let name = this.extractTitle(currentPage);
        
        container.innerHTML = `
            <div class="top-opportunity-card">
                <div class="top-opportunity-image">
                    <div class="top-opportunity-badges">
                        <span class="top-opportunity-badge category">${Utils.escapeHTML(category)}</span>
                        <span class="top-opportunity-badge discipline-tag ${disciplineClass}">${Utils.escapeHTML(this.getMainDiscipline(currentPage.disciplina))}</span>
                    </div>
                    ${window.isUserLoggedIn ? `
                    <div class="top-opportunity-favorite save-opportunity-btn" 
                        data-id="${Utils.escapeHTML(currentPage.id)}" 
                        data-nombre="${Utils.escapeHTML(currentPage.nombre)}" 
                        data-url="${Utils.escapeHTML(currentPage.url)}"
                        data-saved="false"
                        onclick="saveOpportunity(event, this)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    ` : ''}
                    <img src="/static/public/conejos.jpg" alt="${Utils.escapeHTML(name)}" onerror="this.src='/static/public/IsoAtx.png'">
                </div>
                <div class="top-opportunity-content">
                    <h3 class="top-opportunity-title">${Utils.escapeHTML(name)}</h3>
                    
                    <div class="top-opportunity-meta">
                        <div class="top-opportunity-location">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>${Utils.escapeHTML(currentPage.país)}</span>
                        </div>
                        <div class="top-opportunity-inscription">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>${Utils.escapeHTML(currentPage.inscripcion || 'No especificado')}</span>
                        </div>
                        <div class="top-opportunity-discipline">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            <span>${Utils.escapeHTML(this.getMainDiscipline(currentPage.disciplina))}</span>
                        </div>
                        <div class="top-opportunity-date">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    
                    <div class="top-opportunity-description">
                        ${currentPage.og_resumida ? 
                            Utils.escapeHTML(currentPage.og_resumida) : 
                            'Sin descripción disponible'}
                    </div>
                    
                    <button 
                        type="button"
                        class="top-opportunity-button"
                        data-url="${Utils.escapeHTML(currentPage.url)}"
                        data-nombre="${Utils.escapeHTML(currentPage.nombre)}"
                        data-pais="${Utils.escapeHTML(currentPage.país)}"
                        data-og-resumida="${Utils.escapeHTML(currentPage.og_resumida)}"
                        data-id="${Utils.escapeHTML(currentPage.id)}"
                        data-categoria="${Utils.escapeHTML(currentPage.categoria)}"
                        data-requisitos="${Utils.escapeHTML(currentPage.requisitos || '')}"
                        data-disciplina="${Utils.escapeHTML(currentPage.disciplina || '')}"
                        data-fecha-cierre="${Utils.escapeHTML(currentPage.fecha_de_cierre || '')}"
                        data-inscripcion="${Utils.escapeHTML(currentPage.inscripcion || '')}"
                        onclick="showOpportunityDetails(this)">
                        Ver más
                    </button>
                </div>
            </div>
        `;
        
        // Check if the opportunity is already saved
        if (window.isUserLoggedIn) {
            const favoriteBtn = container.querySelector('.top-opportunity-favorite');
            const opportunityId = currentPage.id;
            
            // Check if the opportunity is saved
            fetch(`/is_opportunity_saved?opportunity_id=${opportunityId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.is_saved) {
                        favoriteBtn.setAttribute('data-saved', 'true');
                        favoriteBtn.classList.add('saved');
                        favoriteBtn.querySelector('svg').setAttribute('fill', 'currentColor');
                    }
                })
                .catch(error => console.error('Error checking if opportunity is saved:', error));
        }
    },

    formatDate(dateStr) {
        if (!dateStr || dateStr === '1900-01-01') {
            return 'Confirmar en bases';
        }
        
        // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log('Using timezone-safe parsing for YYYY-MM-DD format in top.js');
            const [year, month, day] = dateStr.split('-').map(Number);
            
            // Format as DD/MM/YYYY with zero-padding
            const formattedDay = String(day).padStart(2, '0');
            const formattedMonth = String(month).padStart(2, '0');
            
            return `${formattedDay}/${formattedMonth}/${year}`;
        }
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return dateStr;
            }
            
            // Format as DD/MM/YYYY
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    },

    getMainDiscipline(disciplineStr) {
        if (!disciplineStr) return 'Otras';
        
        const disciplines = disciplineStr.split(',');
        return disciplines[0].trim();
    },

    getDisciplineClass(disciplineStr) {
        if (!disciplineStr) return 'otros';
        
        const mainDiscipline = this.getMainDiscipline(disciplineStr).toLowerCase();
        
        if (mainDiscipline.includes('visual')) return 'visuales';
        if (mainDiscipline.includes('music') || mainDiscipline.includes('músic')) return 'musica';
        if (mainDiscipline.includes('escénic') || mainDiscipline.includes('escenic') || 
            mainDiscipline.includes('teatro') || mainDiscipline.includes('danza')) return 'escenicas';
        if (mainDiscipline.includes('literatur') || mainDiscipline.includes('escrit')) return 'literatura';
        if (mainDiscipline.includes('diseñ') || mainDiscipline.includes('design')) return 'diseno';
        if (mainDiscipline.includes('cine') || mainDiscipline.includes('audio') || 
            mainDiscipline.includes('film')) return 'cine';
        
        return 'otros';
    },

    // Helper function to extract the title from nombre
    extractTitle(page) {
        let title = '';
        
        // Check if nombre exists and is a string
        if (page.nombre && typeof page.nombre === 'string') {
            // Define all possible separator characters
            const separators = [
                { char: '︱', name: 'PRESENTATION FORM FOR VERTICAL EM DASH', code: 0xFE31 },
                { char: '⎮', name: 'INTEGRAL EXTENSION', code: 0x23AE },
                { char: '|', name: 'VERTICAL LINE', code: 0x007C },
                { char: '｜', name: 'FULLWIDTH VERTICAL LINE', code: 0xFF5C },
                { char: '│', name: 'BOX DRAWINGS LIGHT VERTICAL', code: 0x2502 },
                { char: '┃', name: 'BOX DRAWINGS HEAVY VERTICAL', code: 0x2503 },
                { char: '┊', name: 'BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL', code: 0x250A },
                { char: '┋', name: 'BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL', code: 0x250B }
            ];
            
            // Find the first separator that exists in the string
            let foundSeparator = null;
            let separatorIndex = -1;
            
            for (const separator of separators) {
                const index = page.nombre.indexOf(separator.char);
                if (index !== -1) {
                    foundSeparator = separator;
                    separatorIndex = index;
                    break;
                }
            }
            
            // If we found a separator, split the string
            if (foundSeparator) {
                // Get the parts before and after the separator
                const category = page.nombre.substring(0, separatorIndex).trim();
                const name = page.nombre.substring(separatorIndex + 1).trim();
                
                if (name) {
                    title = name;
                } else {
                    title = 'Sin título';
                }
            } else {
                // If no separator found, use the full nombre
                title = page.nombre.trim();
            }
        } else {
            // Fallback if nombre is not available
            title = 'Sin título';
        }
        
        return title;
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