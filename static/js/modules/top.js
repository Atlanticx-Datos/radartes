import { Utils } from '../utils.js';

export const TopModule = {
    currentIndex: 0,
    pages: [],
    isMobile: false,
    isScrolling: false,
    scrollTimer: null,
    longPressTimer: null,
    scrollDirection: null,

    init(pages) {
        // Filter pages where top is true (accept both boolean true and string "true")
        this.pages = pages.filter(page => page.top === true || page.top === "true");
        
        // Check if we're on mobile
        this.checkMobile();
        
        // Add window resize listener to update mobile status
        window.addEventListener('resize', () => this.checkMobile());
        
        this.updateDisplay();
        this.attachNavigationListeners();
        
        // Create dots container for mobile
        if (this.isMobile) {
            this.createDotsContainer();
            this.updateDotsIndicator();
        }
    },

    // Check if we're on mobile
    checkMobile() {
        const width = window.innerWidth;
        this.isMobile = width < 768;
        console.log('TopModule - Mobile check:', this.isMobile, 'Width:', width);
        
        // Update visibility of navigation buttons based on mobile status
        const prevButton = document.querySelector('.top-prev');
        const nextButton = document.querySelector('.top-next');
        
        if (prevButton) {
            prevButton.style.display = this.isMobile ? 'none' : 'flex';
        }
        
        if (nextButton) {
            nextButton.style.display = this.isMobile ? 'none' : 'flex';
        }
        
        // Update dots container visibility
        const dotsContainer = document.querySelector('.top-dots-container');
        if (dotsContainer) {
            dotsContainer.style.display = this.isMobile ? 'flex' : 'none';
        }
        
        // Update display to reflect mobile changes
        this.updateDisplay();
    },

    // Create dots container if it doesn't exist
    createDotsContainer() {
        // Check if container already exists
        if (document.querySelector('.top-dots-container')) {
            return;
        }
        
        // Create dots container
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'top-dots-container';
        
        // Append after the top-opportunities-container
        const topContainer = document.querySelector('.top-opportunities-container');
        if (topContainer && topContainer.parentNode) {
            topContainer.parentNode.insertBefore(dotsContainer, topContainer.nextSibling);
        }
    },

    nextPage() {
        if (this.currentIndex + 1 < this.pages.length) {
            this.currentIndex++;
            this.updateDisplay();
            
            if (this.isMobile) {
                this.updateDotsIndicator();
                this.scrollToCurrentCard();
            }
        }
    },

    prevPage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateDisplay();
            
            if (this.isMobile) {
                this.updateDotsIndicator();
                this.scrollToCurrentCard();
            }
        }
    },

    // Scroll to the current card
    scrollToCurrentCard() {
        if (!this.isMobile) return;
        
        const container = document.querySelector('.top-opportunities-container');
        const cards = container.querySelectorAll('.top-opportunity-card');
        
        if (container && cards.length > 0 && cards[this.currentIndex]) {
            container.scrollLeft = cards[this.currentIndex].offsetLeft - container.offsetLeft;
        }
    },

    updateDisplay() {
        const container = document.querySelector('.top-opportunities-container .grid');
        if (!container || !this.pages || !this.pages.length) return;

        // Update navigation buttons state
        const prevButton = document.querySelector('.top-prev');
        const nextButton = document.querySelector('.top-next');
        
        if (prevButton && !this.isMobile) {
            prevButton.style.opacity = this.currentIndex > 0 ? '1' : '0.5';
            prevButton.style.cursor = this.currentIndex > 0 ? 'pointer' : 'default';
            prevButton.style.display = 'flex';
        } else if (prevButton) {
            prevButton.style.display = 'none';
        }
        
        if (nextButton && !this.isMobile) {
            nextButton.style.opacity = (this.currentIndex + 1) < this.pages.length ? '1' : '0.5';
            nextButton.style.cursor = (this.currentIndex + 1) < this.pages.length ? 'pointer' : 'default';
            nextButton.style.display = 'flex';
        } else if (nextButton) {
            nextButton.style.display = 'none';
        }

        // On mobile, show all pages for horizontal scrolling
        // On desktop, show only the current page
        if (this.isMobile) {
            // Generate HTML for all pages
            container.innerHTML = this.pages.map((page, index) => {
                return this.generateCardHTML(page, index);
            }).join('');
            
            // Check if each opportunity is already saved
            if (window.isUserLoggedIn) {
                this.pages.forEach(page => {
                    this.checkIfOpportunitySaved(page.id);
                });
            }
        } else {
            // Show only the current page
            const currentPage = this.pages[this.currentIndex];
            if (!currentPage) return;
            
            container.innerHTML = this.generateCardHTML(currentPage, this.currentIndex);
            
            // Check if the opportunity is already saved
            if (window.isUserLoggedIn) {
                this.checkIfOpportunitySaved(currentPage.id);
            }
        }
    },

    // Generate HTML for a single card
    generateCardHTML(page, index) {
        // Get discipline class for styling
        const disciplineClass = this.getDisciplineClass(page.disciplina);
        
        // Format date
        const formattedDate = this.formatDate(page.fecha_de_cierre);
        
        // Extract category and name
        let category = page.categoria || '';
        
        // Extract the title using our helper function
        let name = this.extractTitle(page);
        
        return `
            <div class="top-opportunity-card" data-index="${index}">
                <div class="top-opportunity-image">
                    <div class="top-opportunity-badges">
                        <span class="top-opportunity-badge category">${Utils.escapeHTML(category)}</span>
                        <span class="top-opportunity-badge discipline-tag ${disciplineClass}">${Utils.escapeHTML(this.getMainDiscipline(page.disciplina))}</span>
                    </div>
                    ${window.isUserLoggedIn ? `
                    <div class="top-opportunity-favorite save-opportunity-btn" 
                        data-id="${Utils.escapeHTML(page.id)}" 
                        data-nombre="${Utils.escapeHTML(page.nombre)}" 
                        data-url="${Utils.escapeHTML(page.url)}"
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
                            <span>${Utils.escapeHTML(page.país)}</span>
                        </div>
                        <div class="top-opportunity-inscription">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>${Utils.escapeHTML(page.inscripcion || 'No especificado')}</span>
                        </div>
                        <div class="top-opportunity-discipline">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            <span>${Utils.escapeHTML(this.getMainDiscipline(page.disciplina))}</span>
                        </div>
                        <div class="top-opportunity-date">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    
                    <div class="top-opportunity-description">
                        ${page.og_resumida ? 
                            Utils.escapeHTML(page.og_resumida) : 
                            'Sin descripción disponible'}
                    </div>
                    
                    <button 
                        type="button"
                        class="top-opportunity-button"
                        data-url="${Utils.escapeHTML(page.url)}"
                        data-nombre="${Utils.escapeHTML(page.nombre)}"
                        data-pais="${Utils.escapeHTML(page.país)}"
                        data-og-resumida="${Utils.escapeHTML(page.og_resumida)}"
                        data-id="${Utils.escapeHTML(page.id)}"
                        data-categoria="${Utils.escapeHTML(page.categoria)}"
                        data-requisitos="${Utils.escapeHTML(page.requisitos || '')}"
                        data-disciplina="${Utils.escapeHTML(page.disciplina || '')}"
                        data-fecha-cierre="${Utils.escapeHTML(page.fecha_de_cierre || '')}"
                        data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}"
                        onclick="showOpportunityDetails(this, event)">
                        Ver más
                    </button>
                </div>
            </div>
        `;
    },

    // Check if an opportunity is saved
    checkIfOpportunitySaved(opportunityId) {
        if (!window.isUserLoggedIn) return;
        
        fetch(`/is_opportunity_saved?opportunity_id=${opportunityId}`)
            .then(response => response.json())
            .then(data => {
                if (data.is_saved) {
                    const favoriteBtns = document.querySelectorAll(`.top-opportunity-favorite[data-id="${opportunityId}"]`);
                    favoriteBtns.forEach(btn => {
                        btn.setAttribute('data-saved', 'true');
                        btn.classList.add('saved');
                        btn.querySelector('svg').setAttribute('fill', 'currentColor');
                    });
                }
            })
            .catch(error => console.error('Error checking if opportunity is saved:', error));
    },

    // Update the dots indicator
    updateDotsIndicator() {
        if (!this.isMobile) return;
        
        const dotsContainer = document.querySelector('.top-dots-container');
        if (!dotsContainer) return;
        
        // Calculate the number of dots needed
        const totalDots = Math.min(this.pages.length, 10); // Limit to 10 dots to prevent overflow
        
        // Clear existing dots
        dotsContainer.innerHTML = '';
        
        // Create dots
        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'top-dot';
            if (i === this.currentIndex) {
                dot.classList.add('active');
            }
            
            // Add data attribute for index
            dot.dataset.index = i;
            
            // Add click event
            dot.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.currentIndex = index;
                this.updateDisplay();
                this.updateDotsIndicator();
                this.scrollToCurrentCard();
            });
            
            // Add long press events for scrolling
            dot.addEventListener('mousedown', (e) => this.handleDotLongPress(e, i));
            dot.addEventListener('touchstart', (e) => this.handleDotLongPress(e, i), { passive: true });
            
            // Add mouseup/touchend to stop scrolling
            dot.addEventListener('mouseup', () => this.stopScrolling());
            dot.addEventListener('touchend', () => this.stopScrolling());
            dot.addEventListener('mouseleave', () => this.stopScrolling());
            
            dotsContainer.appendChild(dot);
        }
        
        // Make the dots container visible
        dotsContainer.style.display = 'flex';
    },

    // Handle long press on dots
    handleDotLongPress(e, dotIndex) {
        // Determine scroll direction
        if (dotIndex < this.currentIndex) {
            this.scrollDirection = 'left';
        } else if (dotIndex > this.currentIndex) {
            this.scrollDirection = 'right';
        } else {
            return; // No scrolling needed if clicking the current dot
        }
        
        // Add pulse animation to the dot
        const dot = e.target;
        dot.classList.add('pulse');
        
        // Start scrolling after a short delay (long press)
        this.longPressTimer = setTimeout(() => {
            this.startScrolling();
        }, 300);
    },
    
    // Start scrolling in the specified direction
    startScrolling() {
        this.isScrolling = true;
        
        const scroll = () => {
            if (!this.isScrolling) return;
            
            const container = document.querySelector('.top-opportunities-container');
            if (container) {
                const scrollAmount = this.scrollDirection === 'left' ? -10 : 10;
                container.scrollLeft += scrollAmount;
                requestAnimationFrame(scroll);
            }
        };
        
        scroll();
    },
    
    // Stop scrolling
    stopScrolling() {
        clearTimeout(this.longPressTimer);
        this.isScrolling = false;
        
        // Remove pulse animation from all dots
        document.querySelectorAll('.top-dot').forEach(dot => {
            dot.classList.remove('pulse');
        });
        
        // Update current index based on scroll position
        const container = document.querySelector('.top-opportunities-container');
        if (container) {
            const cardWidth = container.querySelector('.top-opportunity-card')?.offsetWidth || 280;
            const scrollPosition = container.scrollLeft;
            this.currentIndex = Math.round(scrollPosition / cardWidth);
            this.updateDotsIndicator();
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
        
        // Add scroll event listener for mobile to update dots
        const container = document.querySelector('.top-opportunities-container');
        if (container) {
            container.addEventListener('scroll', () => {
                if (!this.isMobile || this.isScrolling) return;
                
                // Debounce the scroll event
                clearTimeout(this.scrollTimer);
                this.scrollTimer = setTimeout(() => {
                    const cards = container.querySelectorAll('.top-opportunity-card');
                    if (!cards.length) return;
                    
                    const cardWidth = cards[0].offsetWidth;
                    const scrollPosition = container.scrollLeft;
                    const newIndex = Math.round(scrollPosition / cardWidth);
                    
                    if (newIndex !== this.currentIndex && newIndex >= 0 && newIndex < this.pages.length) {
                        this.currentIndex = newIndex;
                        this.updateDotsIndicator();
                    }
                }, 100);
            });
        }
    }
}; 