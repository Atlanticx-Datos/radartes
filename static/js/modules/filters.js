import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';
import { SearchModule } from './search.js';

// Handles all filter-related functionality
export const FilterModule = {
    activeFilters: {
        categories: new Set(),
        subdisciplinas: new Set(),
        country: '',
        month: '',
        discipline: 'todos',
        freeOnly: false
    },

    selectedCategories: [],
    lastFilteredResults: [], // Store the last filtered results

    init() {
        console.log('FilterModule initialized');
        
        // Get prefiltered data
        const preFilteredData = document.getElementById('prefiltered-data');
        if (preFilteredData && preFilteredData.dataset.pages) {
            try {
                // Initialize dropdowns with the data
                this.initializeDropdowns();
                
                // Populate subdisciplinas dropdown
                this.populateSubdisciplinas();
                
                // Set up event listeners
                this.setupEventListeners();
                
                console.log('FilterModule initialization complete');
                
                this.updateDisciplineButtons();
                
                // Note: We no longer apply filters on initialization to ensure
                // all pages are shown initially
            } catch (error) {
                console.error('Error initializing FilterModule:', error);
            }
        } else {
            console.warn('No prefiltered data available for FilterModule');
        }
    },

    initializeDropdowns() {
        const pages = JSON.parse(document.getElementById('prefiltered-data')?.dataset.pages || '[]');
        
        // Initialize country dropdown
        const countryFilter = document.getElementById('country-filter');
        if (countryFilter) {
            const countries = [...new Set(pages.map(page => page.pais).filter(Boolean))].sort();
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        }

        // Initialize month dropdown
        const monthFilter = document.getElementById('month-filter');
        if (monthFilter) {
            const months = [
                { value: '1', label: 'Enero' },
                { value: '2', label: 'Febrero' },
                { value: '3', label: 'Marzo' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Mayo' },
                { value: '6', label: 'Junio' },
                { value: '7', label: 'Julio' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Septiembre' },
                { value: '10', label: 'Octubre' },
                { value: '11', label: 'Noviembre' },
                { value: '12', label: 'Diciembre' }
            ];
            months.forEach(month => {
                const option = document.createElement('option');
                option.value = month.value;
                option.textContent = month.label;
                monthFilter.appendChild(option);
            });
        }
    },

    populateSubdisciplinas() {
        const pages = JSON.parse(document.getElementById('prefiltered-data')?.dataset.pages || '[]');
        const subdisciplinasSet = new Set();
        
        // Extract subdisciplinas from the disciplina field (words after the first comma)
        pages.forEach(page => {
            if (page.disciplina) {
                const parts = page.disciplina.split(',');
                if (parts.length > 1) {
                    parts.slice(1).forEach(sub => {
                        const trimmed = sub.trim();
                        if (trimmed) subdisciplinasSet.add(trimmed);
                    });
                }
            }
        });

        // Populate subdisciplinas dropdown
        const subdisciplinasFilter = document.getElementById('subdisciplinas-filter');
        if (subdisciplinasFilter) {
            [...subdisciplinasSet].sort().forEach(sub => {
                const option = document.createElement('option');
                option.value = sub;
                option.textContent = sub;
                subdisciplinasFilter.appendChild(option);
            });
        }
    },

    setupEventListeners() {
        // Categories filter
        const categoriesFilter = document.getElementById('categories-filter');
        if (categoriesFilter) {
            categoriesFilter.addEventListener('change', () => {
                this.activeFilters.categories = new Set(
                    Array.from(categoriesFilter.selectedOptions).map(option => option.value)
                );
            });
        }

        // Subdisciplinas filter
        const subdisciplinasFilter = document.getElementById('subdisciplinas-filter');
        if (subdisciplinasFilter) {
            subdisciplinasFilter.addEventListener('change', () => {
                this.activeFilters.subdisciplinas = new Set(
                    Array.from(subdisciplinasFilter.selectedOptions).map(option => option.value)
                );
            });
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
        }

        // Search button
        const searchButton = document.getElementById('search-filters');
        if (searchButton) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyFilters();
                document.getElementById('structured-filters').classList.add('hidden');
            });
        }
    },

    handleCategoryFilter(e) {
        e.preventDefault();
        e.stopPropagation();
        const category = e.target.dataset.category;
        
        // Toggle category in activeFilters
        if (this.activeFilters.categories.has(category)) {
            this.activeFilters.categories.delete(category);
            e.target.classList.remove('border-blue-500', 'bg-blue-50');
        } else {
            this.activeFilters.categories.add(category);
            e.target.classList.add('border-blue-500', 'bg-blue-50');
        }
        
        this.selectedCategories = Array.from(this.activeFilters.categories);
        this.applyFilters();
    },

    normalizeText(text) {
        if (!text) return '';
        return text.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    },

    belongsToMainDiscipline(discipline, mainDiscipline) {
        const normalizedDiscipline = this.normalizeText(discipline);
        const normalizedMain = this.normalizeText(mainDiscipline);

        // 1. Direct name match
        if (normalizedDiscipline === normalizedMain) {
            console.log(`Direct name match: ${discipline} ≡ ${mainDiscipline}`);
            return true;
        }

        // 2. Group membership check
        const disciplineGroups = CONSTANTS.DISCIPLINE_GROUPS;
        if (disciplineGroups[mainDiscipline]?.has(normalizedDiscipline)) {
            console.log(`Group match: ${discipline} ∈ ${mainDiscipline} group`);
            return true;
        }

        // 3. Special case for "Otras" category (previously "Más")
        if (mainDiscipline === 'Otras') {
            const isGeneric = Array.from(disciplineGroups['Otras']).some(d => 
                this.normalizeText(d) === normalizedDiscipline
            );
            if (isGeneric) {
                console.log(`Otras category match: ${discipline}`);
                return true;
            }
        }

        console.log(`No match for ${discipline} in ${mainDiscipline}`);
        return false;
    },

    handleDisciplineFilter(button, shouldScroll = false) {
        console.log('=== Discipline Filter Start ===');
        const discipline = button.dataset.disciplineFilter;
        console.log('Current discipline:', this.activeFilters.discipline);
        console.log('Clicked discipline:', discipline);
        
        // Set the discipline filter
        this.activeFilters.discipline = discipline;
        
        // First ensure button styling is updated properly - will set data-active
        this.updateDisciplineButtons();
        
        console.log('Using discipline:', this.activeFilters.discipline);
        
        // Update SearchModule's isFiltered flag
        if (window.SearchModule) {
            SearchModule.isFiltered = this.activeFilters.discipline !== 'todos';
            console.log('Updated SearchModule.isFiltered to', SearchModule.isFiltered);
        }

        // Get fresh data and apply filter
        const pages = JSON.parse(document.getElementById('prefiltered-data').dataset.pages);
        let filtered = [...pages];
        
        if (this.activeFilters.discipline !== 'todos') {
            filtered = filtered.filter(page => {
                if (!page.disciplina) return false;
                
                // Simplify the matching logic - just check if the discipline is contained in the page's disciplina field
                const normalizedPageDisciplina = this.normalizeText(page.disciplina);
                const normalizedFilterDiscipline = this.normalizeText(this.activeFilters.discipline);
                
                // Check if the discipline is contained in the page's disciplina field
                const isMatch = normalizedPageDisciplina.includes(normalizedFilterDiscipline);
                
                console.log(`Checking ${page.nombre} - Discipline: "${page.disciplina}" - Match: ${isMatch ? 'YES' : 'NO'}`);
                
                return isMatch;
            });
        }

        // Update visibility of featured section - IMPORTANT: This must happen AFTER filtering
        const featuredSection = document.querySelector('.featured-opportunities');
        const destacadosSection = document.querySelector('.destacados-section');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        console.log('Updating visibility of destacados section. Current discipline:', this.activeFilters.discipline);
        
        if (this.activeFilters.discipline !== 'todos') {
            console.log('Hiding destacados section from FilterModule');
            featuredSection?.classList.add('hidden');
            destacadosSection?.classList.add('hidden');
            prevControl?.classList.add('hidden');
            nextControl?.classList.add('hidden');
        } else {
            console.log('Showing destacados section from FilterModule');
            featuredSection?.classList.remove('hidden');
            destacadosSection?.classList.remove('hidden');
            prevControl?.classList.remove('hidden');
            nextControl?.classList.remove('hidden');
        }
        
        console.log(`Filtered results: ${filtered.length} items`);
        
        // Store the filtered results for reference
        this.lastFilteredResults = filtered;
        
        // Use SearchModule to update the results display with pagination
        if (window.SearchModule && typeof window.SearchModule.updateResults === 'function') {
            console.log('Using SearchModule.updateResults to display results');
            window.SearchModule.updateResults(filtered);
            
            // Scroll to results if requested
            if (shouldScroll && filtered.length > 0 && window.SearchModule.scrollToResults) {
                window.SearchModule.scrollToResults();
            }
        } else {
            console.warn('SearchModule not available, using fallback updateResults');
            this.updateResults(filtered, shouldScroll);
        }
        
        console.log('=== Discipline Filter End ===');
    },

    updateDisciplineButtons() {
        // Update the container style in updateDisciplineButtons() to handle different wrapping behaviors
        const filterContainer = document.querySelector('.filter-container');
        if (filterContainer) {
            // Base styling for all screen sizes
            filterContainer.style.cssText += 'padding: 8px !important; margin-bottom: 8px !important; overflow: visible !important; display: flex !important;';
            
            if (window.innerWidth < 1024) {
                // Mobile/tablet: horizontal scrolling
                filterContainer.style.flexWrap = 'nowrap';
                filterContainer.style.overflowX = 'auto';
                filterContainer.style.paddingLeft = '0 !important';
                filterContainer.style.marginLeft = '-10px !important';
            } else {
                // Desktop/laptop: wrap to new lines
                filterContainer.style.flexWrap = 'wrap';
                filterContainer.style.overflowX = 'visible';
                filterContainer.style.paddingLeft = '12px !important';
                filterContainer.parentElement.style.overflowX = 'visible';
            }
        }
        
        // Reset all buttons to default state
        document.querySelectorAll('[data-discipline-filter]').forEach(btn => {
            // Remove active classes
            btn.classList.remove('active-filter', 'bg-blue-600', 'text-white');
            // Set data-active attribute to false
            btn.dataset.active = 'false';
            // Remove inline styles that might interfere with our CSS
            btn.removeAttribute('style');
            // Apply uniform style for all buttons
            btn.style.cssText = 'background-color: #fdfeff !important; color: #1F1B2D !important; opacity: 1 !important; filter: none !important; border-color: #E5E7EB !important; margin: 4px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.08) !important;';
            
            // Remove any styles on the icon container that might override our CSS
            const iconContainer = btn.querySelector('.icon-container');
            if (iconContainer) {
                iconContainer.removeAttribute('style');
            }
        });

        // Set active button
        const activeButton = document.querySelector(`[data-discipline-filter="${this.activeFilters.discipline}"]`);
        if (activeButton) {
            activeButton.dataset.active = 'true';
            activeButton.style.cssText = 'background-color: #fdfeff !important; color: #1F1B2D !important; opacity: 1 !important; filter: none !important; margin: 4px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.12) !important;';
        }
        
        // Add a style tag to the document to override global CSS styling
        const styleId = 'discipline-button-overrides';
        if (!document.getElementById(styleId)) {
            const styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.innerHTML = `
                .filter-container {
                    padding: 8px !important;
                    margin-bottom: 8px !important;
                    display: flex !important;
                }
                
                /* Hide scrollbar */
                .filter-container::-webkit-scrollbar {
                    display: none !important;
                }
                
                .filter-btn {
                    background-color: #fdfeff !important;
                    opacity: 1 !important;
                    filter: none !important;
                    margin: 4px !important;
                }
                
                /* Active button styling */
                .filter-btn[data-active="true"] {
                    width: auto !important;
                    min-width: fit-content !important;
                    padding-right: 24px !important;
                    padding-left: 16px !important;
                    background-color: #F9FAFB !important;
                    border-color: #D1D5DB !important;
                    border-width: 1px !important;
                    transform: none !important;
                    z-index: 2 !important;
                }
                
                /* Fix icon container overflow */
                .filter-btn .icon-container {
                    overflow: visible !important;
                }
                
                .filter-btn[data-active="true"] .icon-container {
                    transform: scale(1.12) !important;
                    overflow: visible !important;
                }
                
                /* Desktop alignment with overflow protection and wrapping */
                @media (min-width: 1024px) {
                    .filter-container {
                        overflow: visible !important;
                        padding-left: 12px !important;
                        flex-wrap: wrap !important;
                        margin-left: -10px !important;
                    }
                    
                    .filter-container-wrapper, 
                    .filter-container-wrapper > * {
                        overflow: visible !important;
                    }
                    
                    .filter-btn {
                        flex: 0 0 auto !important;
                    }
                }
                
                /* Mobile alignment and scrolling */
                @media (max-width: 1023px) {
                    .filter-container {
                        overflow-x: auto !important;
                        flex-wrap: nowrap !important;
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                        padding-left: 0 !important;
                        margin-left: -10px !important;
                        width: calc(100% + 20px) !important;
                    }
                    
                    .filter-btn {
                        flex: 0 0 auto !important;
                        overflow: visible !important;
                    }
                    
                    .filter-btn[data-active="true"] {
                        min-width: fit-content !important;
                        padding-right: 20px !important;
                        padding-left: 12px !important;
                        transform: none !important;
                        background-color: #F9FAFB !important;
                    }
                }
            `;
            document.head.appendChild(styleTag);
        }
    },

    filterByDiscipline(pages, discipline) {
        return pages.filter(page => {
            const pageDisciplines = page.disciplinas || [];
            return pageDisciplines.some(d => this.belongsToMainDiscipline(d, discipline));
        });
    },

    applyFilters(searchInput = '', shouldScroll = false) {
        const pages = JSON.parse(document.getElementById('prefiltered-data')?.dataset.pages || '[]');
        
        console.log('FilterModule.applyFilters called with:', {
            searchInput,
            shouldScroll,
            activeFilters: this.activeFilters
        });
        
        // Debug the current discipline filter
        console.log('Current discipline filter:', this.activeFilters.discipline);
        
        const filtered = pages.filter(page => {
            // Text search filter
            if (searchInput) {
                // Use normalizeText instead of just toLowerCase to handle diacritics and capitalization
                const searchTerms = searchInput.split(' ')
                    .map(term => this.normalizeText(term))
                    .filter(term => term.length > 0);
                
                if (searchTerms.length > 0) {
                    const pageText = this.normalizeText([
                        page.nombre || '',
                        page.pais || '',
                        page.disciplina || '',
                        page.resumen || '',
                        page.destinatarios || '',
                        page.requisitos || ''
                    ].join(' '));
                    
                    // Check if all search terms are found in the page text
                    const allTermsFound = searchTerms.every(term => pageText.includes(term));
                    if (!allTermsFound) return false;
                }
            }
            
            // Category filter
            if (this.activeFilters.categories.size > 0) {
                const pageCategories = page.categorias || [];
                const normalizedPageCategories = pageCategories.map(cat => this.normalizeText(cat));
                
                // Check if any of the active categories match the page categories
                const hasMatchingCategory = Array.from(this.activeFilters.categories).some(category => 
                    normalizedPageCategories.includes(this.normalizeText(category))
                );
                
                if (!hasMatchingCategory) return false;
            }
            
            // Country filter
            if (this.activeFilters.country) {
                if (!page.pais || this.normalizeText(page.pais) !== this.normalizeText(this.activeFilters.country)) {
                    return false;
                }
            }
            
            // Month filter
            if (this.activeFilters.month) {
                if (!page.fecha_de_cierre) return false;
                
                const monthToFind = String(this.activeFilters.month).padStart(2, '0');
                const pageMonth = page.fecha_de_cierre.split('-')[1];
                
                if (pageMonth !== monthToFind) return false;
            }

            // Add date filter to exclude past opportunities
            if (page.fecha_de_cierre && page.fecha_de_cierre !== '1900-01-01') {
                // Get today's date in YYYY-MM-DD format, using UTC to match backend logic
                const today = new Date();
                const todayStr = today.getUTCFullYear() + '-' + 
                                String(today.getUTCMonth() + 1).padStart(2, '0') + '-' + 
                                String(today.getUTCDate()).padStart(2, '0');
                
                // Compare dates as strings (works for YYYY-MM-DD format)
                if (page.fecha_de_cierre < todayStr) {
                    console.log(`Filtering out expired opportunity: ${page.nombre} - Closing date: ${page.fecha_de_cierre} is before today (${todayStr})`);
                    return false;
                }
            }

            // Discipline filter - use the simplified matching logic
            if (this.activeFilters.discipline !== 'todos') {
                if (!page.disciplina) return false;
                
                const normalizedPageDisciplina = this.normalizeText(page.disciplina);
                const normalizedFilterDiscipline = this.normalizeText(this.activeFilters.discipline);
                
                // Check if the discipline is contained in the page's disciplina field
                if (!normalizedPageDisciplina.includes(normalizedFilterDiscipline)) {
                    console.log(`Filtering out ${page.nombre} - Discipline: "${page.disciplina}" doesn't match "${this.activeFilters.discipline}"`);
                    return false;
                }
                
                console.log(`Including ${page.nombre} - Discipline: "${page.disciplina}" matches "${this.activeFilters.discipline}"`);
            }

            // Free only filter
            if (this.activeFilters.freeOnly && 
                page.inscripcion && 
                this.normalizeText(page.inscripcion) !== 'sin cargo') {
                return false;
            }

            return true;
        });

        // Store the filtered results
        this.lastFilteredResults = filtered;
        
        console.log(`FilterModule.applyFilters: Filtered ${pages.length} pages down to ${filtered.length} results`);
        
        this.updateResults(filtered, shouldScroll);
    },

    matchesSearchTerms(page, searchInput) {
        const searchTerms = searchInput.split(',').map(term => this.normalizeText(term.trim()));
        return searchTerms.every(term => {
            const pageText = this.normalizeText([
                page.nombre,
                page.og_resumida,
                page.entidad,
                page.categoria,
                page.disciplina,
                page.pais
            ].join(' '));
            return pageText.includes(term);
        });
    },

    updateResults(results, shouldScroll = false) {
        console.log(`FilterModule.updateResults called with ${results.length} results`);
        
        // Store the filtered results for reference
        this.lastFilteredResults = results;
        
        // Use SearchModule's updateResults if available
        if (window.SearchModule && typeof window.SearchModule.updateResults === 'function') {
            console.log('Using SearchModule.updateResults from FilterModule');
            
            // Reset pagination in SearchModule when filter results change
            SearchModule.pagination.currentPage = 1;
            SearchModule.pagination.allResults = results;
            SearchModule.pagination.totalPages = Math.ceil(results.length / SearchModule.pagination.itemsPerPage);
            
            // Use SearchModule's updateResults to maintain consistent pagination
            SearchModule.updateResults(results);
            
            // Only trigger scrolling if explicitly requested (Enter key or button click)
            if (shouldScroll && results.length > 0) {
                // Use SearchModule's scrollToResults function if available
                if (SearchModule.scrollToResults) {
                    SearchModule.scrollToResults();
                }
            }
        } else {
            console.warn('SearchModule not available, using fallback display logic');
            
            // Fallback display logic if SearchModule is not available
            const container = document.getElementById('results-container');
            const counter = document.getElementById('results-counter');
            
            if (!container || !counter) {
                console.error('Results container or counter not found');
                return;
            }
            
            if (!results.length) {
                container.innerHTML = '<p class="text-center text-gray-500 my-8">No se encontraron resultados.</p>';
                counter.innerHTML = `
                    <div class="flex justify-between items-center w-full" style="height: 21px; padding: 24px 0;">
                        <div style="line-height: 21px;">0 resultados encontrados</div>
                    </div>
                `;
                return;
            }
            
            // Simple display of all results without pagination
            container.innerHTML = results.map(page => `
                <div class="opportunity-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <h3 class="font-bold text-lg mb-2">${this.escapeHTML(page.nombre || 'Sin nombre')}</h3>
                    <p class="text-sm text-gray-600 mb-2">${this.escapeHTML(page.og_resumida || '')}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-500">${this.escapeHTML(page.disciplina || '')}</span>
                        <button 
                            class="preview-btn text-blue-600 hover:underline text-sm"
                            data-url="${this.escapeHTML(page.url || '')}"
                            data-base-url="${this.escapeHTML(page.base_url || '')}"
                            data-name="${this.escapeHTML(page.nombre || '')}"
                            data-country="${this.escapeHTML(page.pais || '')}"
                            data-summary="${this.escapeHTML(page.og_resumida || '')}"
                            data-category="${this.escapeHTML(page.categoria || '')}"
                            data-id="${this.escapeHTML(page.id || '')}"
                        >
                            Ver más
                        </button>
                    </div>
                </div>
            `).join('');
            
            counter.innerHTML = `
                <div class="flex justify-between items-center w-full" style="height: 21px; padding: 24px 0;">
                    <div style="line-height: 21px;">${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}</div>
                </div>
            `;
            
            // Scroll to results if requested
            if (shouldScroll && results.length > 0) {
                const radarHeader = document.getElementById('radar-header');
                if (radarHeader) {
                    radarHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    },
    
    // Helper function to escape HTML
    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    clearAllFilters() {
        // Reset all active filters
        this.activeFilters = {
            categories: new Set(),
            subdisciplinas: new Set(),
            country: '',
            month: '',
            discipline: 'todos',
            freeOnly: false
        };

        // Reset UI elements
        const elements = {
            'categories-filter': el => el.querySelectorAll('option').forEach(opt => opt.selected = false),
            'subdisciplinas-filter': el => el.querySelectorAll('option').forEach(opt => opt.selected = false),
            'country-filter': el => el.value = '',
            'month-filter': el => el.value = '',
            'inscripcion-checkbox': el => el.checked = false
        };

        Object.entries(elements).forEach(([id, resetFn]) => {
            const element = document.getElementById(id);
            if (element) resetFn(element);
        });
        
        // Reset SearchModule's isFiltered flag
        if (window.SearchModule) {
            SearchModule.isFiltered = false;
            console.log('Reset SearchModule.isFiltered to false');
        }

        // Update results
        this.applyFilters();
        
        // Close dropdown
        document.getElementById('structured-filters')?.classList.add('hidden');
    },

    removeExistingHandlers() {
        document.querySelectorAll('[data-discipline-filter]').forEach(button => {
            button.replaceWith(button.cloneNode(true));
        });
    },

    addNewHandlers() {
        document.querySelectorAll('[data-discipline-filter]').forEach(button => {
            button.addEventListener('click', (e) => this.handleDisciplineFilter(button));
        });
    }
};