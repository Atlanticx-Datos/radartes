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
        
        // Sort pages by fecha_de_cierre (closing date)
        this.pages = pages.sort((a, b) => {
            // Handle missing dates by pushing them to the end
            if (!a.fecha_de_cierre) return 1;
            if (!b.fecha_de_cierre) return -1;
            
            // Handle placeholder dates (1900-01-01) by pushing them to the end
            if (a.fecha_de_cierre === '1900-01-01') return 1;
            if (b.fecha_de_cierre === '1900-01-01') return -1;
            
            // Sort by fecha_de_cierre
            return new Date(a.fecha_de_cierre) - new Date(b.fecha_de_cierre);
        });
        
        console.log('First page in DestacarModule after sorting:', this.pages[0]);
        
        // Check if we're on mobile
        this.checkMobile();
        
        // Set cards per page based on screen size
        this.setCardsPerPage();
        
        // Preload images for better performance
        this.preloadImages();
        
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

    /**
     * Preload images for better performance
     */
    preloadImages() {
        // First, preload the placeholder image to ensure it's available immediately
        const placeholderUrl = '/static/public/destacarCardsImages/placeholder.jpg';
        const placeholderImg = new Image();
        placeholderImg.src = placeholderUrl;
        
        // Only preload the first few pages to avoid excessive network requests
        const pagesToPreload = this.pages.slice(0, Math.min(9, this.pages.length));
        
        // Create a set to track unique image URLs
        const imageUrls = new Set();
        
        // Collect image URLs for preloading
        pagesToPreload.forEach(page => {
            if (!page) return;
            
            // Get discipline info
            const disciplines = page.disciplina ? page.disciplina.split(',').map(d => d.trim()).filter(Boolean) : [];
            const mainDiscipline = disciplines.length > 0 ? disciplines[0] : 'General';
            
            // Normalize discipline
            const normalizedDiscipline = mainDiscipline.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '');
                
            // Get image URL
            const imageUrl = this.getImageForDiscipline(normalizedDiscipline, page.categoria);
            imageUrls.add(imageUrl);
        });
        
        // Remove placeholder from the set since we've already preloaded it
        imageUrls.delete(placeholderUrl);
        
        // Preload remaining images with a slight delay to prioritize visible content
        setTimeout(() => {
            imageUrls.forEach(url => {
                const img = new Image();
                img.src = url;
            });
            
            console.log(`Preloaded ${imageUrls.size + 1} images for destacar cards (including placeholder)`);
        }, 300);
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
                     data-base-url="${Utils.escapeHTML(page.base_url || '')}"
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
                        <img src="${this.getImageForDiscipline(normalizedDiscipline, page.categoria)}" 
                             alt="${Utils.escapeHTML(mainDiscipline)} ${Utils.escapeHTML(page.categoria || '')}" 
                             class="w-full h-full object-cover"
                             loading="lazy"
                             onerror="this.onerror=null; this.src='/static/public/destacarCardsImages/placeholder.jpg';">
                        <div class="absolute inset-0 bg-gray-200 animate-pulse image-placeholder"></div>
                        <span class="absolute top-3 left-3 text-sm">
                            ${Utils.escapeHTML(page.categoria || '')}
                        </span>
                        <span class="discipline-badge ${disciplineClass}">
                            ${Utils.escapeHTML(mainDiscipline)}
                        </span>
                        <button class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 favorite-btn" data-id="${Utils.escapeHTML(page.id || '')}">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="p-2">
                        <div>
                            <h3 class="font-medium text-lg" title="${Utils.escapeHTML(title)}">
                                ${Utils.escapeHTML(title)}
                            </h3>
                            
                            <div class="flex flex-wrap gap-4 text-sm text-gray-600">
                                <div class="meta-row">
                                    <div class="flex items-center gap-1">
                                        <svg class="w-4 h-4" viewBox="0 0 36 41" fill="currentColor">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M18 13.9995C15.7908 13.9995 14 15.7904 14 17.9995C14 20.2086 15.7908 21.9995 18 21.9995C20.2091 21.9995 22 20.2086 22 17.9995C22 15.7904 20.2091 13.9995 18 13.9995ZM9.99996 17.9995C9.99996 13.5812 13.5817 9.99949 18 9.99949C22.4182 9.99949 26 13.5812 26 17.9995C26 22.4178 22.4182 25.9995 18 25.9995C13.5817 25.9995 9.99996 22.4178 9.99996 17.9995Z" fill="currentColor"/>
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M18 4C15.2311 4 12.5244 4.82107 10.2221 6.35938C7.91983 7.89768 6.12541 10.0841 5.06576 12.6423C4.00612 15.2004 3.72883 18.0153 4.26896 20.731C4.8091 23.4467 6.14239 25.9413 8.10026 27.8992L16.5875 36.3845C16.9625 36.7591 17.4709 36.9696 18.001 36.9696C18.5311 36.9696 19.0395 36.7591 19.4145 36.3845L27.8998 27.8992C29.8576 25.9413 31.1909 23.4467 31.7311 20.731C32.2712 18.0153 31.9939 15.2004 30.9343 12.6423C29.8746 10.0841 28.0802 7.89768 25.7779 6.35938C23.4756 4.82107 20.7689 4 18 4ZM30.7283 30.7276C33.2455 28.2102 34.9598 25.0029 35.6542 21.5113C36.3487 18.0196 35.9922 14.4005 34.6297 11.1115C33.2673 7.82247 30.9602 5.01131 28.0002 3.03348C25.0401 1.05566 21.56 0 18 0C14.44 0 10.9599 1.05566 7.99984 3.03348C5.03978 5.01131 2.73267 7.82247 1.37027 11.1115C0.00786066 14.4005 -0.348654 18.0196 0.345805 21.5113C1.04026 25.0029 2.75451 28.2102 5.27176 30.7276L13.76 39.2138C14.885 40.3377 16.4108 40.9696 18.001 40.9696C19.5913 40.9696 21.1165 40.3382 22.2415 39.2143L30.7283 30.7276Z" fill="currentColor"/>
                                        </svg>
                                        <span>${Utils.escapeHTML(page.país || '')}</span>
                                    </div>
                                    
                                    <div class="flex items-center gap-1">
                                        ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                            '<div class="flex items-center gap-1"><img src="/static/public/icons/cash.svg" alt="Payment" class="w-4 h-4" /><img src="/static/public/icons/money_off.svg" alt="Free" class="w-4 h-4" /></div>' : 
                                            '<div class="flex items-center gap-1"><img src="/static/public/icons/cash.svg" alt="Payment" class="w-4 h-4" /><img src="/static/public/icons/money_on.svg" alt="Paid" class="w-4 h-4" /></div>'
                                        }
                                    </div>
                                    
                                    <div class="flex items-center gap-1 subdisciplines-inline">
                                        <img src="/static/public/icons/disciplines.svg" alt="Disciplines" class="w-4 h-4" />
                                        <span title="${Utils.escapeHTML(subdisciplines)}">${Utils.escapeHTML(subdisciplines || 'Sin subdisciplinas')}</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-1 date-row">
                                    <img src="/static/public/icons/calendar.svg" alt="Calendar" class="w-4 h-4" />
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
                            sanitizedData.baseUrl || sanitizedData.base_url || (sanitizedData.url && sanitizedData.url.startsWith('http') ? sanitizedData.url : null), // Use base_url if available, fall back to url if it's a valid URL
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
        
        // Add event listeners for image loading
        container.querySelectorAll('.opportunity-preview img').forEach(img => {
            // If image is already loaded or cached
            if (img.complete) {
                img.classList.add('loaded');
            } else {
                // Add load event listener
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                });
            }
            
            // Add error event listener to ensure placeholder is shown
            img.addEventListener('error', () => {
                img.src = '/static/public/destacarCardsImages/placeholder.jpg';
                img.classList.add('loaded');
            });
        });
        
        // Add click handlers for favorite buttons
        container.querySelectorAll('.favorite-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the card click event
                e.preventDefault();
                
                // If user is not logged in, show message
                if (!window.isUserLoggedIn) {
                    if (window.Utils && window.Utils.showAlert) {
                        window.Utils.showAlert('Necesitas ingresar para guardar favoritos', 'error');
                    } else {
                        alert('Necesitas ingresar para guardar favoritos');
                    }
                    return;
                }
                
                // If user is logged in, proceed with normal save functionality
                const opportunityId = button.getAttribute('data-id');
                if (!opportunityId) {
                    console.error('No opportunity ID found for favorite button');
                    return;
                }
                
                // Get CSRF token
                const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
                if (!csrfToken) {
                    console.error('No CSRF token found');
                    return;
                }
                
                // Create form data
                const formData = new FormData();
                formData.append('page_id', opportunityId);
                formData.append('csrf_token', csrfToken);
                
                // Show loading state
                button.disabled = true;
                const originalSvg = button.innerHTML;
                button.innerHTML = '<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                
                // Send save request
                fetch('/save_from_modal', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => {
                    // Reset button state
                    button.disabled = false;
                    button.innerHTML = originalSvg;
                    
                    if (response.ok) {
                        // Show success message
                        if (window.Utils && window.Utils.showAlert) {
                            window.Utils.showAlert('Oportunidad guardada exitosamente', 'success');
                        } else {
                            alert('Oportunidad guardada exitosamente');
                        }
                        
                        // Change the button color to indicate it's saved
                        button.querySelector('svg').setAttribute('fill', '#6232FF');
                        button.querySelector('svg').setAttribute('stroke', 'white');
                        
                        // Refresh saved opportunities if the function exists
                        if (window.ModalModule && window.ModalModule.refreshSavedOpportunities) {
                            window.ModalModule.refreshSavedOpportunities();
                        }
                    } else {
                        throw new Error('Error saving opportunity');
                    }
                })
                .catch(error => {
                    // Reset button state
                    button.disabled = false;
                    button.innerHTML = originalSvg;
                    
                    console.error('Error saving opportunity:', error);
                    if (window.Utils && window.Utils.showAlert) {
                        window.Utils.showAlert('Error al guardar la oportunidad', 'error');
                    } else {
                        alert('Error al guardar la oportunidad');
                    }
                });
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

    /**
     * Get the appropriate image URL for a discipline
     * @param {string} normalizedDiscipline - The normalized discipline name
     * @param {string} category - The category of the opportunity
     * @return {string} - The URL of the image to use
     */
    getImageForDiscipline(normalizedDiscipline, category) {
        // Base path for destacar card images
        const basePath = '/static/public/destacarCardsImages/';
        
        // Normalize the category (lowercase, remove accents, remove spaces)
        const normalizedCategory = category ? category.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '') : '';
        
        // Map of disciplines to normalized values
        const disciplineMap = {
            'visuales': 'visuales',
            'musica': 'musica',
            'escenicas': 'escenicas',
            'literatura': 'literatura',
            'diseno': 'diseno',
            'cine': 'cine',
            'audiovisual': 'cine', // Map audiovisual to cine
            'otras': 'otras'
        };
        
        // Map of categories to normalized values
        const categoryMap = {
            'beca': 'beca',
            'residencia': 'residencia',
            'premio': 'premio',
            'concurso': 'concurso',
            'convocatoria': 'convocatoria',
            'oportunidad': 'oportunidad',
            'fondos': 'fondos',
            'apoyo': 'apoyo'
        };
        
        // Get the discipline key if it exists in our map
        let disciplineKey = null;
        for (const [key, value] of Object.entries(disciplineMap)) {
            if (normalizedDiscipline.includes(key)) {
                disciplineKey = value;
                break;
            }
        }
        
        // Get the category key if it exists in our map
        let categoryKey = null;
        for (const [key, value] of Object.entries(categoryMap)) {
            if (normalizedCategory.includes(key)) {
                categoryKey = value;
                break;
            }
        }
        
        // Since both category and discipline are always available, we'll focus on pairs
        if (categoryKey && disciplineKey) {
            // Try the specific pair first
            const pairPath = `${basePath}pairs/${categoryKey}-${disciplineKey}.jpg`;
            
            // Check if we have this specific pair image
            if (this.isPairImageAvailable(categoryKey, disciplineKey)) {
                return pairPath;
            }
        }
        
        // If we don't have a specific pair image, use a discipline-based image
        if (disciplineKey) {
            return `${basePath}${disciplineKey}.jpg`;
        }
        
        // Final fallback
        return `${basePath}placeholder.jpg`;
    },
    
    /**
     * Check if a specific category-discipline pair image is available
     * This is a simplified version that uses a predefined list of available pairs
     * In a production environment, you might want to use a more dynamic approach
     */
    isPairImageAvailable(category, discipline) {
        // List of available pair images
        // This could be loaded from a configuration file or generated dynamically
        const availablePairs = [
            // Scholarship (Beca) pairs
            'beca-visuales', 'beca-musica', 'beca-escenicas', 'beca-literatura', 'beca-diseno', 'beca-cine', 'beca-otras',
            
            // Residency (Residencia) pairs
            'residencia-visuales', 'residencia-musica', 'residencia-escenicas', 'residencia-literatura', 'residencia-diseno', 'residencia-cine', 'residencia-otras',
            
            // Award (Premio) pairs
            'premio-visuales', 'premio-musica', 'premio-escenicas', 'premio-literatura', 'premio-diseno', 'premio-cine', 'premio-otras',
            
            // Contest (Concurso) pairs
            'concurso-visuales', 'concurso-musica', 'concurso-escenicas', 'concurso-literatura', 'concurso-diseno', 'concurso-cine', 'concurso-otras',
            
            // Call (Convocatoria) pairs
            'convocatoria-visuales', 'convocatoria-musica', 'convocatoria-escenicas', 'convocatoria-literatura', 'convocatoria-diseno', 'convocatoria-cine', 'convocatoria-otras',
            
            // Opportunity (Oportunidad) pairs
            'oportunidad-visuales', 'oportunidad-musica', 'oportunidad-escenicas', 'oportunidad-literatura', 'oportunidad-diseno', 'oportunidad-cine', 'oportunidad-otras',
            
            // Funds (Fondos) pairs
            'fondos-visuales', 'fondos-musica', 'fondos-escenicas', 'fondos-literatura', 'fondos-diseno', 'fondos-cine', 'fondos-otras',
            
            // Support (Apoyo) pairs
            'apoyo-visuales', 'apoyo-musica', 'apoyo-escenicas', 'apoyo-literatura', 'apoyo-diseno', 'apoyo-cine', 'apoyo-otras'
        ];
        
        return availablePairs.includes(`${category}-${discipline}`);
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