import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';
import { SearchModule } from './search.js';

// Handles all filter-related functionality
export const FilterModule = {
    activeFilters: {
        categories: new Set(),
        country: '',
        month: '',
        discipline: 'todos'
    },

    selectedCategories: [],

    init() {
        this.initializeDropdowns();
        this.removeExistingHandlers();
        this.addNewHandlers();
    },

    initializeDropdowns() {
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
        const featuredSection = document.querySelector('.featured-opportunities');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        if (this.activeFilters.discipline !== 'todos') {
            featuredSection?.classList.add('hidden');
            prevControl?.classList.add('hidden');
            nextControl?.classList.add('hidden');
        } else {
            featuredSection?.classList.remove('hidden');
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

    applyFilters(searchInput = '') {
        const pages = JSON.parse(document.getElementById('prefiltered-data').dataset.pages);
        const featuredSection = document.querySelector('.featured-opportunities');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        // Hide featured section and controls when filtering
        if (searchInput || this.activeFilters.categories.size > 0 || 
            this.activeFilters.country || this.activeFilters.month || 
            this.activeFilters.discipline !== 'todos') {
            featuredSection?.classList.add('hidden');
            prevControl?.classList.add('hidden');
            nextControl?.classList.add('hidden');
        } else {
            featuredSection?.classList.remove('hidden');
            prevControl?.classList.remove('hidden');
            nextControl?.classList.remove('hidden');
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
                return pageCategories.some(cat => this.activeFilters.categories.has(cat));
            });
        }

        // Apply country filter
        if (this.activeFilters.country) {
            filtered = filtered.filter(page => page.pais === this.activeFilters.country);
        }

        // Apply month filter
        if (this.activeFilters.month) {
            filtered = filtered.filter(page => {
                const pageMonth = new Date(page.fecha_de_cierre).getMonth() + 1;
                return parseInt(this.activeFilters.month) === pageMonth;
            });
        }

        // Apply discipline filter
        if (this.activeFilters.discipline !== 'todos') {
            filtered = this.filterByDiscipline(filtered, this.activeFilters.discipline);
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
        
        // Reset pagination
        SearchModule.pagination.currentPage = 1;
        
        // Trigger search to update results
        this.applyFilters();
        
        // Close the filters dropdown if it's open
        document.getElementById('structured-filters').classList.add('hidden');
        
        // Show featured section and controls when clearing all filters
        const featuredSection = document.querySelector('.featured-opportunities');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        
        featuredSection?.classList.remove('hidden');
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