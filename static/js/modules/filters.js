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

    init() {
        const preFilteredData = document.getElementById('prefiltered-data');
        if (!preFilteredData) return;

        this.initializeDropdowns();
        this.setupEventListeners();
        this.populateSubdisciplinas();
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

    applyFilters(searchInput = '', shouldScroll = false) {
        const pages = JSON.parse(document.getElementById('prefiltered-data')?.dataset.pages || '[]');
        
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

            // Free only filter
            if (this.activeFilters.freeOnly && 
                page.inscripcion && 
                this.normalizeText(page.inscripcion) !== 'sin cargo') {
                return false;
            }

            return true;
        });

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
        // Reset pagination in SearchModule when filter results change
        SearchModule.pagination.currentPage = 1;
        SearchModule.pagination.allResults = results;
        SearchModule.pagination.totalPages = Math.ceil(results.length / SearchModule.pagination.itemsPerPage);
        
        // Use SearchModule's updateResults to maintain consistent pagination
        SearchModule.updateResults(results);
        
        // Only trigger scrolling if explicitly requested (Enter key or button click)
        if (shouldScroll && results.length > 0 && (
            this.activeFilters.categories.size > 0 || 
            this.activeFilters.country || 
            this.activeFilters.month || 
            this.activeFilters.discipline !== 'todos' ||
            this.activeFilters.freeOnly ||
            document.getElementById('open-search')?.value
        )) {
            // Use SearchModule's scrollToResults function if available
            if (SearchModule.scrollToResults) {
                SearchModule.scrollToResults();
            }
        }
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

// Remove the global handler
window.handleDisciplineFilter = undefined;

// Initialize the module
document.addEventListener('DOMContentLoaded', () => {
    FilterModule.init();
}); 