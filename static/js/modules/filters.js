import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';
import { SearchModule } from './search.js';

// Handles all filter-related functionality
export const FilterModule = {
    activeFilters: {
        categories: new Set(),
        country: '',
        month: '',
        discipline: 'todos',
        freeOnly: false  // New filter for "Sin cargo" opportunities
    },

    selectedCategories: [],

    init() {
        // Only initialize if we're on a page with filters
        const preFilteredData = document.getElementById('prefiltered-data');
        if (!preFilteredData) {
            return; // Skip initialization if we're not on a page with filters
        }
        this.initializeDropdowns();
        this.removeExistingHandlers();
        this.addNewHandlers();
        
        // Remove the change event listener from the inscripcion checkbox
        // The checkbox state will be read when the user clicks the "Buscar" button
    },

    initializeDropdowns() {
        const preFilteredData = document.getElementById('prefiltered-data');
        if (!preFilteredData) return;  // Skip if element doesn't exist
        
        const pages = JSON.parse(document.getElementById('prefiltered-data').dataset.pages);
        
        // Initialize country dropdown
        const countryFilter = document.getElementById('country-filter');
        const countries = [...new Set(pages.map(page => page.pais).filter(Boolean))].sort();
        
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilter.appendChild(option);
        });

        // Initialize month dropdown
        const monthFilter = document.getElementById('month-filter');
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

    handleDisciplineFilter(button) {
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

        // Get fresh data and apply filter
        const pages = JSON.parse(document.getElementById('prefiltered-data').dataset.pages);
        let filtered = [...pages];
        
        if (this.activeFilters.discipline !== 'todos') {
            filtered = filtered.filter(page => {
                if (!page.disciplina) return false;
                
                const pageDisciplines = page.disciplina
                    .split(',')
                    .map(d => d.trim());
                
                console.log(`Checking ${page.nombre} with disciplines:`, pageDisciplines);

                return pageDisciplines.some(d => {
                    const isMatch = this.belongsToMainDiscipline(d, this.activeFilters.discipline);
                    console.log(`- "${d}" → "${this.normalizeText(d)}" vs "${this.activeFilters.discipline}" → "${this.normalizeText(this.activeFilters.discipline)}": ${isMatch ? 'MATCH' : 'NO MATCH'}`);
                    return isMatch;
                });
            });
        }

        // Update visibility of featured section
        const destacadosContainer = document.querySelector('.destacados-container');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        if (this.activeFilters.discipline !== 'todos') {
            destacadosContainer?.classList.add('hidden');
            prevControl?.classList.add('hidden');
            nextControl?.classList.add('hidden');
        } else {
            destacadosContainer?.classList.remove('hidden');
            prevControl?.classList.remove('hidden');
            nextControl?.classList.remove('hidden');
        }

        console.log('Filtered results count:', filtered.length);
        this.updateResults(filtered);
        console.log('=== Discipline Filter End ===');
    },

    updateDisciplineButtons() {
        // Reset all buttons to default state
        document.querySelectorAll('[data-discipline-filter]').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('border-gray-300', 'text-gray-700');
        });

        // If we're in 'todos' state, highlight the todos button
        if (this.activeFilters.discipline === 'todos') {
            const todosButton = document.querySelector('[data-discipline-filter="todos"]');
            if (todosButton) {
                todosButton.classList.remove('border-gray-300', 'text-gray-700');
                todosButton.classList.add('bg-blue-600', 'text-white');
            }
        } else {
            // Highlight the active discipline button
            const activeButton = document.querySelector(`[data-discipline-filter="${this.activeFilters.discipline}"]`);
            if (activeButton) {
                activeButton.classList.remove('border-gray-300', 'text-gray-700');
                activeButton.classList.add('bg-blue-600', 'text-white');
            }
        }
    },

    filterByDiscipline(pages, discipline) {
        return pages.filter(page => {
            const pageDisciplines = page.disciplinas || [];
            return pageDisciplines.some(d => this.belongsToMainDiscipline(d, discipline));
        });
    },

    applyFilters(searchInput = '', fromStructuredSearch = false) {
        const pages = JSON.parse(document.getElementById('prefiltered-data').dataset.pages);
        const destacadosContainer = document.querySelector('.destacados-container');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        // Check if any filter is active
        const hasActiveFilters = searchInput || 
            this.activeFilters.categories.size > 0 || 
            this.activeFilters.country || 
            this.activeFilters.month || 
            this.activeFilters.discipline !== 'todos' ||
            this.activeFilters.freeOnly;  // Include the new filter in the check

        console.log('Filter state:', {
            searchInput,
            categories: this.activeFilters.categories.size,
            country: this.activeFilters.country,
            month: this.activeFilters.month,
            discipline: this.activeFilters.discipline,
            freeOnly: this.activeFilters.freeOnly,  // Log the new filter state
            hasActiveFilters,
            fromStructuredSearch
        });
        
        // Only manage visibility if not coming from structured search
        if (!fromStructuredSearch) {
            if (hasActiveFilters) {
                destacadosContainer?.classList.add('hidden');
                prevControl?.classList.add('hidden');
                nextControl?.classList.add('hidden');
            } else {
                destacadosContainer?.classList.remove('hidden');
                prevControl?.classList.remove('hidden');
                nextControl?.classList.remove('hidden');
            }
        }

        let filtered = pages;

        // Apply search filter
        if (searchInput) {
            filtered = filtered.filter(page => this.matchesSearchTerms(page, searchInput));
        }

        // Apply category filters
        if (this.activeFilters.categories.size > 0) {
            filtered = filtered.filter(page => {
                if (!page.categoria) return false;
                const pageCategories = page.categoria.toLowerCase().split(',').map(c => c.trim());
                return Array.from(this.activeFilters.categories).some(cat => 
                    pageCategories.includes(cat.toLowerCase())
                );
            });
        }

        // Apply country filter
        if (this.activeFilters.country) {
            console.log('Applying country filter:', this.activeFilters.country);
            filtered = filtered.filter(page => {
                // Handle both pais and país variations
                const pageCountry = page.pais || page.país || '';
                if (!pageCountry) {
                    console.log('Page has no country field:', page.nombre);
                    return false;
                }
                const normalizedPageCountry = Utils.normalizeText(pageCountry);
                const normalizedFilterCountry = Utils.normalizeText(this.activeFilters.country);
                const match = normalizedPageCountry === normalizedFilterCountry;
                console.log(`Country check: "${pageCountry}" (${normalizedPageCountry}) vs "${this.activeFilters.country}" (${normalizedFilterCountry}) = ${match}`);
                return match;
            });
        }

        // Apply month filter
        if (this.activeFilters.month) {
            console.log('Applying month filter:', this.activeFilters.month);
            filtered = filtered.filter(page => {
                // Check for different possible date field names
                const dateField = page.fecha_de_cierre || page.fecha_cierre || page.fecha || '';
                if (!dateField) {
                    console.log('Page has no date field:', page.nombre);
                    return false;
                }
                
                console.log(`Processing date for "${page.nombre}": ${dateField}`);
                
                let pageMonth;
                try {
                    // Try to parse the date
                    const dateObj = new Date(dateField);
                    if (isNaN(dateObj.getTime())) {
                        // If date is invalid, try to extract month from string format
                        // Try different date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
                        let dateParts;
                        
                        if (dateField.includes('/')) {
                            dateParts = dateField.split('/');
                            // Assume DD/MM/YYYY format
                            pageMonth = parseInt(dateParts[1]);
                        } else if (dateField.includes('-')) {
                            dateParts = dateField.split('-');
                            // Assume YYYY-MM-DD format
                            pageMonth = parseInt(dateParts[1]);
                        } else if (dateField.includes('.')) {
                            dateParts = dateField.split('.');
                            // Assume DD.MM.YYYY format
                            pageMonth = parseInt(dateParts[1]);
                        } else {
                            console.log(`Unrecognized date format for "${page.nombre}": ${dateField}`);
                            return false;
                        }
                        
                        console.log(`Extracted month from string: ${pageMonth} from ${dateField}`);
                    } else {
                        pageMonth = dateObj.getMonth() + 1; // getMonth() is 0-indexed
                        console.log(`Extracted month from Date object: ${pageMonth} from ${dateField}`);
                    }
                } catch (error) {
                    console.error(`Error parsing date for "${page.nombre}":`, error);
                    return false;
                }
                
                const filterMonth = parseInt(this.activeFilters.month);
                const match = filterMonth === pageMonth;
                console.log(`Month check for "${page.nombre}": "${dateField}" → month ${pageMonth} vs filter ${filterMonth} = ${match}`);
                return match;
            });
        }

        // Apply discipline filter
        if (this.activeFilters.discipline !== 'todos') {
            filtered = filtered.filter(page => {
                if (!page.disciplina) return false;
                const pageDisciplines = page.disciplina.split(',').map(d => d.trim());
                return pageDisciplines.some(d => this.belongsToMainDiscipline(d, this.activeFilters.discipline));
            });
        }
        
        // Apply free-only filter (new)
        if (this.activeFilters.freeOnly) {
            filtered = filtered.filter(page => {
                // Include pages that have no inscripcion value or have "Sin cargo"
                return !page.inscripcion || page.inscripcion.trim().toLowerCase() === 'sin cargo';
            });
        }

        console.log('Filtered results:', filtered.length);
        this.updateResults(filtered);
    },

    matchesSearchTerms(page, searchInput) {
        const searchTerms = searchInput.split(',').map(term => Utils.normalizeText(term.trim()));
        return searchTerms.every(term => {
            const pageText = Utils.normalizeText([
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

    updateResults(results) {
        // Reset pagination in SearchModule when filter results change
        SearchModule.pagination.currentPage = 1;
        SearchModule.pagination.allResults = results;
        SearchModule.pagination.totalPages = Math.ceil(results.length / SearchModule.pagination.itemsPerPage);
        
        // Use SearchModule's updateResults to maintain consistent pagination
        SearchModule.updateResults(results);
    },

    clearAllFilters() {
        // Clear search input
        document.getElementById('open-search').value = '';
        
        // Clear category filters
        this.activeFilters.categories.clear();
        this.selectedCategories = [];
        document.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        // Clear country filter
        document.getElementById('country-filter').value = '';
        this.activeFilters.country = '';
        
        // Clear month filter
        document.getElementById('month-filter').value = '';
        this.activeFilters.month = '';
        
        // Reset discipline to 'todos'
        this.activeFilters.discipline = 'todos';
        document.querySelectorAll('[data-discipline-filter]').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('border-gray-300', 'text-gray-700');
            if (btn.dataset.disciplineFilter === 'todos') {
                btn.classList.remove('border-gray-300', 'text-gray-700');
                btn.classList.add('bg-blue-600', 'text-white');
            }
        });
        
        // Clear inscripcion filter
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');
        if (inscripcionCheckbox) {
            inscripcionCheckbox.checked = false;
        }
        this.activeFilters.freeOnly = false;
        
        // Reset pagination
        SearchModule.pagination.currentPage = 1;
        
        // Trigger search to update results
        this.applyFilters();
        
        // Close the filters dropdown if it's open
        document.getElementById('structured-filters').classList.add('hidden');
        
        // Show featured section and controls when clearing all filters
        const destacadosContainer = document.querySelector('.destacados-container');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        destacadosContainer?.classList.remove('hidden');
        prevControl?.classList.remove('hidden');
        nextControl?.classList.remove('hidden');
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

// Remove the global handler
window.handleDisciplineFilter = undefined;

// Initialize the module
document.addEventListener('DOMContentLoaded', () => {
    FilterModule.init();
}); 