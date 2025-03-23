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
        
        // Add a listener for DOMContentLoaded to ensure checkDescriptionLength runs after page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOMContentLoaded event fired, checking descriptions');
                setTimeout(() => this.checkDescriptionLength(), 500);
            });
        } else {
            // DOMContentLoaded has already fired
            console.log('DOM already loaded, checking descriptions now');
            setTimeout(() => this.checkDescriptionLength(), 500);
        }
        
        // Set up a MutationObserver to detect when new descriptions are added to the DOM
        this.setupMutationObserver();
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
        if (!container || !this.pages || !this.pages.length) {
            console.error('TopModule - updateDisplay: Missing container or pages');
            return;
        }

        console.log('TopModule - updateDisplay: Starting to update display');

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

        // Add a slight delay to ensure content is rendered before checking
        console.log('TopModule - updateDisplay: Setting timeout for checkDescriptionLength');
        setTimeout(() => {
            console.log('TopModule - updateDisplay: Timeout fired, calling checkDescriptionLength');
            this.checkDescriptionLength();
        }, 100);
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
                    <div class="top-opportunity-favorite save-opportunity-btn" 
                        data-id="${Utils.escapeHTML(page.id)}" 
                        data-nombre="${Utils.escapeHTML(page.nombre)}" 
                        data-url="${Utils.escapeHTML(page.url)}"
                        data-base-url="${Utils.escapeHTML(page.base_url || '')}"
                        data-saved="false"
                        onclick="saveOpportunity(event, this)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    <img src="/static/public/conejos.jpg" alt="${Utils.escapeHTML(name)}" onerror="this.src='/static/public/IsoAtx.png'">
                </div>
                <div class="top-opportunity-content">
                    <div>
                        <h3 class="top-opportunity-title">${Utils.escapeHTML(name)}</h3>
                        
                        <div class="top-opportunity-meta">
                            <div class="top-opportunity-location">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 36 41" stroke-width="1.5" stroke="currentColor">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M18 13.9995C15.7908 13.9995 14 15.7904 14 17.9995C14 20.2086 15.7908 21.9995 18 21.9995C20.2091 21.9995 22 20.2086 22 17.9995C22 15.7904 20.2091 13.9995 18 13.9995ZM9.99996 17.9995C9.99996 13.5812 13.5817 9.99949 18 9.99949C22.4182 9.99949 26 13.5812 26 17.9995C26 22.4178 22.4182 25.9995 18 25.9995C13.5817 25.9995 9.99996 22.4178 9.99996 17.9995Z" fill="currentColor"/>
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M18 4C15.2311 4 12.5244 4.82107 10.2221 6.35938C7.91983 7.89768 6.12541 10.0841 5.06576 12.6423C4.00612 15.2004 3.72883 18.0153 4.26896 20.731C4.8091 23.4467 6.14239 25.9413 8.10026 27.8992L16.5875 36.3845C16.9625 36.7591 17.4709 36.9696 18.001 36.9696C18.5311 36.9696 19.0395 36.7591 19.4145 36.3845L27.8998 27.8992C29.8576 25.9413 31.1909 23.4467 31.7311 20.731C32.2712 18.0153 31.9939 15.2004 30.9343 12.6423C29.8746 10.0841 28.0802 7.89768 25.7779 6.35938C23.4756 4.82107 20.7689 4 18 4ZM30.7283 30.7276C33.2455 28.2102 34.9598 25.0029 35.6542 21.5113C36.3487 18.0196 35.9922 14.4005 34.6297 11.1115C33.2673 7.82247 30.9602 5.01131 28.0002 3.03348C25.0401 1.05566 21.56 0 18 0C14.44 0 10.9599 1.05566 7.99984 3.03348C5.03978 5.01131 2.73267 7.82247 1.37027 11.1115C0.00786066 14.4005 -0.348654 18.0196 0.345805 21.5113C1.04026 25.0029 2.75451 28.2102 5.27176 30.7276L13.76 39.2138C14.885 40.3377 16.4108 40.9696 18.001 40.9696C19.5913 40.9696 21.1165 40.3382 22.2415 39.2143L30.7283 30.7276Z" fill="currentColor"/>
                                </svg>
                                <span>${Utils.escapeHTML(page.país)}</span>
                            </div>
                            <div class="top-opportunity-inscription">
                                <div class="flex items-center gap-1">
                                    <img src="/static/public/icons/cash.svg" alt="Payment" class="payment-icon" />
                                    ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                        '<img src="/static/public/icons/money_off.svg" alt="Free" class="payment-icon" />' : 
                                        '<img src="/static/public/icons/money_on.svg" alt="Paid" class="payment-icon" />'
                                    }
                                </div>
                                <span>${Utils.escapeHTML(page.inscripcion || 'No especificado')}</span>
                            </div>
                            <div class="top-opportunity-discipline">
                                <img src="/static/public/icons/disciplines.svg" alt="Disciplines" class="w-4 h-4" />
                                <span>${Utils.escapeHTML(this.getMainDiscipline(page.disciplina))}</span>
                            </div>
                            <div class="top-opportunity-date">
                                <img src="/static/public/icons/calendar.svg" alt="Calendar" class="w-4 h-4" />
                                <span>${formattedDate}</span>
                            </div>
                        </div>
                        
                        <div class="top-opportunity-description" data-full-length="${page.og_resumida ? page.og_resumida.length : 0}">
                            ${page.og_resumida ? 
                                Utils.escapeHTML(page.og_resumida) : 
                                'Sin descripción disponible'}
                        </div>
                    </div>
                    
                    <button 
                        type="button"
                        class="top-opportunity-button"
                        data-url="${Utils.escapeHTML(page.url)}"
                        data-base-url="${Utils.escapeHTML(page.base_url || '')}"
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
        // Only check saved status if user is logged in
        if (window.isUserLoggedIn) {
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
        }
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
    },

    // Add a function to check if description needs expansion
    checkDescriptionLength() {
        console.log('Running checkDescriptionLength...');
        // Find all description elements
        const descriptions = document.querySelectorAll('.top-opportunity-description');
        console.log('Found descriptions:', descriptions.length);
        
        descriptions.forEach((desc, index) => {
            console.log(`Processing description ${index + 1}`);
            // Remove any existing buttons to prevent duplicates
            const existingBtn = desc.querySelector('.expand-description-btn');
            if (existingBtn) {
                console.log('Found existing button, removing it');
                existingBtn.remove();
            }
            
            // Get the description text
            const descriptionText = desc.textContent.trim();
            console.log('Description text length:', descriptionText.length);
            
            // Skip empty descriptions or placeholders
            if (!descriptionText || descriptionText === 'Sin descripción disponible') {
                console.log('Empty description or placeholder, not adding button');
                return;
            }
            
            // Always add the expand button if text is longer than 100 characters
            // This ensures the button is visible even with fixed height
            if (descriptionText.length > 100) {
                console.log('Description is long enough for button');
                
                // Create "más" button - inline with description text
                const expandBtn = document.createElement('button');
                expandBtn.className = 'expand-description-btn';
                expandBtn.textContent = ' más';  // Space before "más" to separate from text
                expandBtn.setAttribute('aria-expanded', 'false');
                console.log('Created expand button');
                
                // Add click handler
                expandBtn.addEventListener('click', (e) => {
                    console.log('Expand button clicked');
                    e.preventDefault(); // Prevent any unwanted default behavior
                    const button = e.currentTarget;
                    const isExpanded = button.getAttribute('aria-expanded') === 'true';
                    
                    if (isExpanded) {
                        // Collapse
                        desc.classList.remove('expanded');
                        button.textContent = ' más';
                        button.setAttribute('aria-expanded', 'false');
                        console.log('Description collapsed');
                    } else {
                        // Expand
                        desc.classList.add('expanded');
                        button.textContent = ' menos';
                        button.setAttribute('aria-expanded', 'true');
                        console.log('Description expanded');
                    }
                    
                    // Stop event propagation to prevent triggering card click
                    e.stopPropagation();
                });
                
                // Insert the button - first add ellipsis
                const spacer = document.createTextNode('... ');
                desc.appendChild(spacer);
                
                // Then add the button
                desc.appendChild(expandBtn);
                console.log('Button appended to description');
            } else {
                console.log('Description is too short, no button needed');
            }
        });
        
        console.log('checkDescriptionLength completed');
    },

    // Setup a mutation observer to detect new descriptions
    setupMutationObserver() {
        // Create a new observer instance
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            // Look through all mutations
            mutations.forEach((mutation) => {
                // If nodes were added
                if (mutation.addedNodes.length) {
                    // Check if any of the added nodes are description elements or contain them
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.classList && node.classList.contains('top-opportunity-description')) {
                                shouldCheck = true;
                            } else if (node.querySelector && node.querySelector('.top-opportunity-description')) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            });
            
            // If we found descriptions that were added, check them
            if (shouldCheck) {
                console.log('New descriptions detected in DOM, checking lengths');
                setTimeout(() => this.checkDescriptionLength(), 200);
            }
        });
        
        // Start observing the document with the configured parameters
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
        
        console.log('Mutation observer set up for description detection');
    }
}; 