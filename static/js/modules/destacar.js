import { Utils } from '../utils.js';

// Handles featured content carousel
export const DestacarModule = {
    currentIndex: 0,
    pages: [],
    cardsPerPage: 3, // Default, will be adjusted based on screen size
    isMobile: false, // Flag to check if we're on mobile
    longPressTimer: null, // Timer for long press
    scrollDirection: null, // Direction to scroll when long pressing
    isScrolling: false, // Flag to prevent multiple scroll operations

    init(pages) {
        console.log('DestacarModule.init called with pages:', pages);
        console.log('Pages type:', typeof pages);
        console.log('Pages length:', Array.isArray(pages) ? pages.length : 'not an array');
        
        if (!pages || !Array.isArray(pages) || pages.length === 0) {
            console.warn('DestacarModule initialized with empty or invalid pages array');
            this.pages = [];
            return;
        }
        
        this.pages = pages;
        console.log('First page in DestacarModule:', this.pages[0]);
        
        // Check if we're on mobile
        this.checkMobile();
        
        // Set cards per page based on screen size
        this.setCardsPerPage();
        
        // Add resize listener to adjust cards per page when window size changes
        window.addEventListener('resize', () => {
            const oldCardsPerPage = this.cardsPerPage;
            const wasMobile = this.isMobile;
            
            this.checkMobile();
            this.setCardsPerPage();
            
            // Only update display if the number of cards per page has changed or mobile status changed
            if (oldCardsPerPage !== this.cardsPerPage || wasMobile !== this.isMobile) {
                // Adjust currentIndex to maintain position when resizing
                this.currentIndex = Math.floor(this.currentIndex / oldCardsPerPage) * this.cardsPerPage;
                this.updateDisplay();
            }
        });
        
        this.updateDisplay();
        this.attachNavigationListeners();
        
        // Force a check after a short delay to ensure mobile view is properly applied
        setTimeout(() => {
            this.checkMobile();
            this.updateDisplay();
        }, 500);
    },

    // Check if we're on mobile
    checkMobile() {
        const width = window.innerWidth;
        this.isMobile = width < 768;
        console.log('Mobile check:', this.isMobile, 'Width:', width);
        
        // Update visibility of navigation buttons based on mobile status
        const prevButton = document.querySelector('.destacar-prev');
        const nextButton = document.querySelector('.destacar-next');
        
        if (prevButton) {
            prevButton.style.display = this.isMobile ? 'none' : 'flex';
        }
        
        if (nextButton) {
            nextButton.style.display = this.isMobile ? 'none' : 'flex';
        }
        
        // Update dots container visibility
        const dotsContainer = document.querySelector('.destacar-dots-container');
        if (dotsContainer) {
            dotsContainer.style.display = this.isMobile ? 'flex' : 'none';
        }
    },

    // Set the number of cards to display based on screen width
    setCardsPerPage() {
        const width = window.innerWidth;
        if (width < 768) {
            this.cardsPerPage = 1;
        } else if (width < 1024) {
            this.cardsPerPage = 2;
        } else {
            this.cardsPerPage = 3;
        }
    },

    nextPage() {
        console.log('DestacarModule.nextPage called');
        console.log('Current index:', this.currentIndex);
        console.log('Pages length:', this.pages.length);
        
        if (this.currentIndex + this.cardsPerPage < this.pages.length) {
            this.currentIndex += this.cardsPerPage;
            console.log('New index:', this.currentIndex);
            this.updateDisplay();
        } else {
            console.log('Already at the last page');
        }
    },

    prevPage() {
        console.log('DestacarModule.prevPage called');
        console.log('Current index:', this.currentIndex);
        
        if (this.currentIndex > 0) {
            this.currentIndex -= this.cardsPerPage;
            console.log('New index:', this.currentIndex);
            this.updateDisplay();
        } else {
            console.log('Already at the first page');
        }
    },

    // Helper function to extract the title from nombre_original
    extractTitle(page) {
        let title = '';
        
        // Check if nombre_original exists and is a string
        if (page.nombre_original && typeof page.nombre_original === 'string') {
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
                const index = page.nombre_original.indexOf(separator.char);
                if (index !== -1) {
                    foundSeparator = separator;
                    separatorIndex = index;
                    break;
                }
            }
            
            // If we found a separator, split the string
            if (foundSeparator) {
                // Get the parts before and after the separator
                const category = page.nombre_original.substring(0, separatorIndex).trim();
                const name = page.nombre_original.substring(separatorIndex + 1).trim();
                
                if (name) {
                    title = name;
                } else {
                    // If there's nothing after the separator, use the nombre field if available
                    title = (page.nombre && page.nombre.trim()) || 'Sin título';
                }
            } else {
                // If no separator found, try to extract from the fallback title
                // This handles the case where the separator might be added later in the process
                
                // Check if the nombre field contains a separator
                if (page.nombre && typeof page.nombre === 'string') {
                    // Check for separators in the nombre field
                    for (const separator of separators) {
                        const index = page.nombre.indexOf(separator.char);
                        if (index !== -1) {
                            const parts = page.nombre.split(separator.char);
                            if (parts.length > 1 && parts[1] && parts[1].trim()) {
                                title = parts[1].trim();
                                return title; // Return early since we found a valid title
                            }
                        }
                    }
                }
                
                // If no separator found in nombre either, check if the title starts with a known category
                const knownCategories = ['Beca', 'Convocatoria', 'Premio', 'Residencia', 'Concurso', 'Oportunidad'];
                let foundCategory = false;
                
                for (const category of knownCategories) {
                    if (page.nombre_original.startsWith(category)) {
                        // Try to extract a title after the category
                        const afterCategory = page.nombre_original.substring(category.length).trim();
                        if (afterCategory) {
                            title = afterCategory;
                            foundCategory = true;
                            break;
                        }
                    }
                }
                
                if (!foundCategory) {
                    // Special case: Check if the fallback title already contains the separator
                    const fallbackTitle = (page.nombre && page.nombre.trim()) || page.nombre_original.trim();
                    
                    // If the fallback title contains "︱", try to extract the part after it
                    if (fallbackTitle.includes('︱')) {
                        const parts = fallbackTitle.split('︱');
                        if (parts.length > 1 && parts[1] && parts[1].trim()) {
                            title = parts[1].trim();
                            return title;
                        }
                    }
                    
                    // If we still don't have a title, use the fallback
                    title = fallbackTitle;
                }
            }
        } else if (page.nombre && typeof page.nombre === 'string') {
            // If nombre_original is not available but nombre is, use nombre
            title = page.nombre.trim();
        } else {
            // Fallback if neither is available
            title = 'Sin título';
        }
        
        return title;
    },

    updateDisplay() {
        console.log('DestacarModule.updateDisplay called, isMobile:', this.isMobile);
        
        const container = document.querySelector('.featured-opportunities .flex');
        if (!container) {
            console.error('Featured opportunities container not found');
            return;
        }
        
        if (!this.pages || !this.pages.length) {
            console.warn('No pages available to display');
            return;
        }
        
        // Update navigation buttons state (opacity) instead of visibility
        const prevButton = document.querySelector('.destacar-prev');
        const nextButton = document.querySelector('.destacar-next');
        
        if (prevButton && !this.isMobile) {
            prevButton.style.opacity = this.currentIndex > 0 ? '1' : '0.5';
            prevButton.style.cursor = this.currentIndex > 0 ? 'pointer' : 'default';
            prevButton.setAttribute('aria-disabled', this.currentIndex === 0 ? 'true' : 'false');
            prevButton.style.display = 'flex';
        } else if (prevButton) {
            prevButton.style.display = 'none';
        }
        
        if (nextButton && !this.isMobile) {
            nextButton.style.opacity = (this.currentIndex + this.cardsPerPage) < this.pages.length ? '1' : '0.5';
            nextButton.style.cursor = (this.currentIndex + this.cardsPerPage) < this.pages.length ? 'pointer' : 'default';
            nextButton.setAttribute('aria-disabled', (this.currentIndex + this.cardsPerPage) >= this.pages.length ? 'true' : 'false');
            nextButton.style.display = 'flex';
        } else if (nextButton) {
            nextButton.style.display = 'none';
        }

        // On mobile, show all pages for horizontal scrolling
        const pagesToShow = this.isMobile ? this.pages : this.pages.slice(this.currentIndex, this.currentIndex + this.cardsPerPage);
        console.log('Pages to show:', pagesToShow.length, 'Mobile:', this.isMobile);

        // Function to format date
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr === '1900-01-01') {
                return 'Confirmar en bases';
            }
            
            // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
            if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.log('Using timezone-safe parsing for YYYY-MM-DD format in destacar.js');
                const [year, month, day] = dateStr.split('-').map(Number);
                
                // Month is 0-indexed in JavaScript Date
                const monthIndex = month - 1;
                
                const monthMap = {
                    0: 'Ene', 1: 'Feb', 2: 'Mar', 3: 'Abr', 4: 'May', 5: 'Jun',
                    6: 'Jul', 7: 'Ago', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dic'
                };
                
                // Format with day zero-padded
                const formattedDay = String(day).padStart(2, '0');
                return `${formattedDay}/${monthMap[monthIndex]}/${year}`;
            }
            
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return dateStr;
                }
                
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

        container.innerHTML = pagesToShow
            .map(page => {
                // Extract the first discipline for the badge
                const disciplines = page.disciplina ? page.disciplina.split(',').map(d => d.trim()).filter(Boolean) : [];
                const mainDiscipline = disciplines.length > 0 ? disciplines[0] : 'General';
                
                // Get the normalized discipline for the class
                const normalizedDiscipline = mainDiscipline.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
                    .replace(/\s+/g, ''); // Remove spaces
                
                // Get the discipline class
                const disciplineClass = this.getDisciplineClass(normalizedDiscipline);
                
                // Extract the title using our helper function
                const title = this.extractTitle(page);
                
                // Get subdisciplines (everything after the first discipline)
                const subdisciplines = disciplines.slice(1).join(', ');
                
                return `
                <div class="bg-white rounded-lg shadow-md overflow-hidden relative cursor-pointer opportunity-preview"
                     data-url="${Utils.escapeHTML(page.url)}"
                     data-nombre="${Utils.escapeHTML(page.nombre_original || '')}"
                     data-country="${Utils.escapeHTML(page.país || '')}"
                     data-summary="${Utils.escapeHTML(page.og_resumida || '')}"
                     data-id="${Utils.escapeHTML(page.id || '')}"
                     data-category="${Utils.escapeHTML(page.categoria || '')}"
                     data-requisitos="${Utils.escapeHTML(page.requisitos || '')}"
                     data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}"
                     data-disciplina="${Utils.escapeHTML(page.disciplina || '')}"
                     data-fecha-cierre="${Utils.escapeHTML(page.fecha_de_cierre || '')}"
                     data-fecha-cierre-raw="${page.fecha_de_cierre || ''}">
                    <div class="relative h-48 bg-gray-200">
                        <img src="/static/public/IsoAtx.png" alt="Atlantic x Logo" class="w-full h-full object-contain">
                        <span class="absolute top-3 left-3 text-sm">
                            ${Utils.escapeHTML(page.categoria || '')}
                        </span>
                        <span class="discipline-badge ${disciplineClass}">
                            ${Utils.escapeHTML(mainDiscipline)}
                        </span>
                        ${window.isUserLoggedIn ? `
                        <button class="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                    
                    <div class="p-2">
                        <div>
                            <h3 class="font-medium text-lg" title="${Utils.escapeHTML(title)}">
                                ${Utils.escapeHTML(title)}
                            </h3>
                            
                            <div class="flex flex-wrap gap-4 text-sm text-gray-600">
                                <div class="meta-row">
                                    <div class="flex items-center gap-1">
                                        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>${Utils.escapeHTML(page.país || '')}</span>
                                    </div>
                                    
                                    <div class="flex items-center gap-1">
                                        ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                            '<div class="relative inline-block"><svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg><svg class="absolute top-0 left-0 w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="5" x2="19" y2="19"/></svg></div>' : 
                                            '<svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg>'
                                        }
                                    </div>
                                    
                                    <div class="flex items-center gap-1 subdisciplines-inline">
                                        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                                        </svg>
                                        <span title="${Utils.escapeHTML(subdisciplines)}">${Utils.escapeHTML(subdisciplines || 'Sin subdisciplinas')}</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-1 date-row">
                                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                    </svg>
                                    <span>${formatDate(page.fecha_de_cierre)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

        // Attach click handlers to the newly created opportunity cards
        container.querySelectorAll('.opportunity-preview').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const dataset = element.dataset;
                
                // Log the clicked element for debugging
                console.log('Destacar module clicked element:', {
                    element: element,
                    classList: element.classList,
                    dataset: dataset
                });
                
                // Sanitize data to handle special characters
                const sanitizedData = {};
                for (const key in dataset) {
                    sanitizedData[key] = String(dataset[key] || '').trim();
                }
                
                if (window.ModalModule && window.ModalModule.showPreviewModal) {
                    console.log('Destacar module click handler data:', sanitizedData);
                    
                    // Use the global showOpportunityDetails function if available
                    if (window.showOpportunityDetails && typeof window.showOpportunityDetails === 'function') {
                        console.log('Using global showOpportunityDetails function');
                        window.showOpportunityDetails(element, e);
                    } else {
                        // Fallback to direct call
                        window.ModalModule.showPreviewModal(
                            sanitizedData.url,
                            sanitizedData.nombre,
                            sanitizedData.country,
                            sanitizedData.summary,
                            sanitizedData.id,
                            sanitizedData.category,
                            null,  // base_url parameter
                            sanitizedData.requisitos,
                            sanitizedData.disciplina,
                            sanitizedData.fechaCierre || sanitizedData.fecha_cierre, // Try both kebab-case and camelCase
                            sanitizedData.inscripcion
                        );
                    }
                } else {
                    console.error('ModalModule not found or showPreviewModal not available');
                    // Fallback - open in new tab
                    if (sanitizedData.url) {
                        window.open(sanitizedData.url, '_blank');
                    }
                }
            });
        });
        
        // Update dots indicator for mobile
        this.updateDotsIndicator();
        
        // If on mobile, scroll to the current card
        if (this.isMobile) {
            const featuredContainer = document.querySelector('.featured-opportunities');
            const cards = container.querySelectorAll('.opportunity-preview');
            if (featuredContainer && cards.length > 0 && cards[this.currentIndex]) {
                setTimeout(() => {
                    featuredContainer.scrollLeft = cards[this.currentIndex].offsetLeft - featuredContainer.offsetLeft;
                }, 100);
            }
        }
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
        
        // Add scroll event listener for mobile to update dots
        const container = document.querySelector('.featured-opportunities');
        if (container) {
            container.addEventListener('scroll', () => {
                if (!this.isMobile || this.isScrolling) return;
                
                // Debounce the scroll event
                clearTimeout(this.scrollTimer);
                this.scrollTimer = setTimeout(() => {
                    const cards = container.querySelectorAll('.opportunity-preview');
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
    },

    /**
     * Get the CSS class for a discipline
     */
    getDisciplineClass(discipline) {
        const disciplineMap = {
            'visuales': 'discipline-visuales',
            'musica': 'discipline-musica',
            'escenicas': 'discipline-escenicas',
            'literatura': 'discipline-literatura',
            'diseno': 'discipline-diseno',
            'cine': 'discipline-cine',
            'otras': 'discipline-otras'
        };
        
        // Check for partial matches
        for (const [key, className] of Object.entries(disciplineMap)) {
            if (discipline.includes(key)) {
                return className;
            }
        }
        
        return 'discipline-default';
    },

    // Update the dots indicator
    updateDotsIndicator() {
        if (!this.isMobile) return;
        
        const dotsContainer = document.querySelector('.destacar-dots-container');
        if (!dotsContainer) return;
        
        // Calculate the number of dots needed
        const totalDots = Math.min(this.pages.length, 10); // Limit to 10 dots to prevent overflow
        
        // Clear existing dots
        dotsContainer.innerHTML = '';
        
        // Create dots
        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'destacar-dot';
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
                
                // Scroll to the selected card
                const container = document.querySelector('.featured-opportunities');
                const cards = container.querySelectorAll('.opportunity-preview');
                if (container && cards.length > 0 && cards[index]) {
                    container.scrollLeft = cards[index].offsetLeft - container.offsetLeft;
                }
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
        const currentDotIndex = Math.floor(this.currentIndex / this.cardsPerPage);
        
        // Determine scroll direction
        if (dotIndex < currentDotIndex) {
            this.scrollDirection = 'left';
        } else if (dotIndex > currentDotIndex) {
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
        if (this.isScrolling) return;
        this.isScrolling = true;
        
        const container = document.querySelector('.featured-opportunities');
        if (!container) return;
        
        const scrollAmount = this.scrollDirection === 'left' ? -10 : 10;
        
        const scroll = () => {
            if (!this.isScrolling) return;
            container.scrollLeft += scrollAmount;
            requestAnimationFrame(scroll);
        };
        
        scroll();
    },
    
    // Stop scrolling
    stopScrolling() {
        clearTimeout(this.longPressTimer);
        this.isScrolling = false;
        
        // Remove pulse animation from all dots
        document.querySelectorAll('.destacar-dot').forEach(dot => {
            dot.classList.remove('pulse');
        });
        
        // Update current index based on scroll position
        const container = document.querySelector('.featured-opportunities');
        if (container) {
            const cardWidth = container.querySelector('.opportunity-preview')?.offsetWidth || 280;
            const scrollPosition = container.scrollLeft;
            this.currentIndex = Math.round(scrollPosition / cardWidth);
            this.updateDotsIndicator();
        }
    }
}; 