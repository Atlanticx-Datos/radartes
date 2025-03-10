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
        
        // Simple toggle: if same discipline is clicked, switch to 'todos'
        if (discipline === this.activeFilters.discipline) {
            this.activeFilters.discipline = 'todos';
        } else {
            this.activeFilters.discipline = discipline;
        }
        
        console.log('New discipline state:', this.activeFilters.discipline);
        
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
        // Reset all buttons to default state
        document.querySelectorAll('[data-discipline-filter]').forEach(btn => {
            btn.classList.remove('active-filter', 'bg-blue-600', 'text-white');
            btn.dataset.active = 'false';
        });

        // If we're in 'todos' state, highlight the todos button
        if (this.activeFilters.discipline === 'todos') {
            const todosButton = document.querySelector('[data-discipline-filter="todos"]');
            if (todosButton) {
                todosButton.classList.add('active-filter');
                todosButton.dataset.active = 'true';
            }
        } else {
            // Highlight the active discipline button
            const activeButton = document.querySelector(`[data-discipline-filter="${this.activeFilters.discipline}"]`);
            if (activeButton) {
                activeButton.classList.add('active-filter');
                activeButton.dataset.active = 'true';
            }
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
        
        // Update SearchModule's isFiltered flag
        if (window.SearchModule) {
            SearchModule.isFiltered = searchInput.trim().length > 0 || 
                                     this.activeFilters.categories.size > 0 || 
                                     this.activeFilters.country || 
                                     this.activeFilters.month || 
                                     this.activeFilters.discipline !== 'todos' ||
                                     this.activeFilters.freeOnly;
            console.log('Updated SearchModule.isFiltered to', SearchModule.isFiltered);
        }
        
        const filtered = pages.filter(page => {
            // Text search filter
            if (searchInput && !this.matchesSearchTerms(page, searchInput)) return false;

            // Categories filter
            if (this.activeFilters.categories.size > 0) {
                const pageCategory = this.normalizeText(page.categoria);
                const categoryMatch = Array.from(this.activeFilters.categories).some(category => {
                    const normalizedCategory = this.normalizeText(category);
                    return pageCategory.startsWith(normalizedCategory);
                });
                if (!categoryMatch) return false;
            }

            // Subdisciplinas filter
            if (this.activeFilters.subdisciplinas.size > 0) {
                const disciplinaParts = (page.disciplina || '').split(',').map(p => p.trim());
                const subdisciplinasMatch = Array.from(this.activeFilters.subdisciplinas).some(sub =>
                    disciplinaParts.slice(1).some(pageSub => 
                        this.normalizeText(pageSub) === this.normalizeText(sub)
                    )
                );
                if (!subdisciplinasMatch) return false;
            }

            // Country filter
            if (this.activeFilters.country && 
                this.normalizeText(page.pais) !== this.normalizeText(this.activeFilters.country)) {
                return false;
            }

            // Month filter
            if (this.activeFilters.month) {
                const pageMonth = page.fecha_de_cierre ? page.fecha_de_cierre.split('-')[1] : '';
                if (pageMonth !== String(this.activeFilters.month).padStart(2, '0')) return false;
            }

            // Discipline filter - use the simplified matching logic
            if (this.activeFilters.discipline !== 'todos') {
                if (!page.disciplina) return false;
                
                const normalizedPageDisciplina = this.normalizeText(page.disciplina);
                const normalizedFilterDiscipline = this.normalizeText(this.activeFilters.discipline);
                
                // Check if the discipline is contained in the page's disciplina field
                if (!normalizedPageDisciplina.includes(normalizedFilterDiscipline)) return false;
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
                counter.textContent = '0 resultados encontrados';
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
            
            counter.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
            
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