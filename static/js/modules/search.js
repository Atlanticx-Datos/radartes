import { Utils } from '../utils.js';
import { FilterModule } from './filters.js';
import { CONSTANTS } from '../constants.js';

// Handles search functionality
export const SearchModule = {
    searchInProgress: false,
    searchTimeout: null,
    activeFilters: {
        categories: new Set(),
        months: new Set(),
        countries: new Set()
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 12,
        totalPages: 1,
        allResults: []
    },
    sorting: {
        column: null,
        active: false
    },

    init() {
        // Initialize with data from the page
        const preFilteredData = document.getElementById('prefiltered-data');
        if (preFilteredData) {
            try {
                const tempParser = new DOMParser();
                const pagesString = tempParser.parseFromString(preFilteredData.dataset.pages, 'text/html').body.textContent;
                const pages = JSON.parse(pagesString);

                console.log('Initializing search module with:', {
                    pageCount: pages.length,
                    firstPage: pages[0]
                });

                this.initializeStructuredFilters(pages);
                
                // Add single event listener for preview buttons using event delegation
                document.addEventListener('click', (e) => {
                    const previewButton = e.target.closest('.preview-btn');
                    if (!previewButton) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const dataset = previewButton.dataset;
                    console.log('Preview button clicked, data:', dataset);
                    
                    if (window.ModalModule && window.ModalModule.showPreviewModal) {
                        window.ModalModule.showPreviewModal(
                            dataset.url,
                            dataset.nombre || dataset.name,
                            dataset.pais || dataset.country,
                            dataset.og_resumida || dataset.summary,
                            dataset.id,
                            dataset.categoria || dataset.category
                        );
                    } else {
                        console.error('ModalModule not found or showPreviewModal not available');
                    }
                });
            } catch (e) {
                console.error('Search module initialization error:', e);
            }
        }

        this.attachSearchListeners();
        this.updateFilterUI();
    },

    updateFilterUI() {
        // Update checkboxes to match state
        document.querySelectorAll('.category-filter').forEach(checkbox => {
            checkbox.checked = this.activeFilters.categories.has(checkbox.value);
        });

        // Update the filter summary display
        const filterSummary = document.querySelector('#filter-summary');
        if (filterSummary) {
            const categories = Array.from(this.activeFilters.categories);
            if (categories.length > 0) {
                filterSummary.textContent = `Categorías seleccionadas: ${categories.join(', ')}`;
                filterSummary.classList.remove('hidden');
            } else {
                filterSummary.textContent = '';
                filterSummary.classList.add('hidden');
            }
        }
    },

    initializeStructuredFilters(pages) {
        // Country dropdown
        const countryFilter = document.getElementById('country-filter');
        if (countryFilter) {
            // Clear existing options except the first one (if it's a placeholder)
            while (countryFilter.options.length > 1) {
                countryFilter.remove(1);
            }

            // Get unique countries and sort them
            const uniqueCountries = [...new Set(pages
                .map(p => p.país)
                .filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'es'));

            // Add new options
            uniqueCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        }

        // Month dropdown
        const monthFilter = document.getElementById('month-filter');
        if (monthFilter) {
            // Clear existing options except the first one
            while (monthFilter.options.length > 1) {
                monthFilter.remove(1);
            }

            // Add month options
            Object.entries(CONSTANTS.MONTH_MAPPING).forEach(([monthName, monthNumber]) => {
                const option = document.createElement('option');
                option.value = monthNumber;
                option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                monthFilter.appendChild(option);
            });
        }

        // Attach event listeners for structured filters
        this.attachStructuredFilterListeners();
    },

    attachStructuredFilterListeners() {
        // Category filter buttons
        document.querySelectorAll('[data-category-filter]').forEach(button => {
            button.addEventListener('click', (e) => this.handleCategoryFilter(e));
        });

        // Month filter buttons
        document.querySelectorAll('[data-month-filter]').forEach(button => {
            button.addEventListener('click', () => this.handleMonthFilter(button));
        });

        // Search button
        const searchButton = document.getElementById('search-filters');
        console.log('Search button found:', !!searchButton);  // Debug log
        
        if (searchButton) {
            // Remove any existing listeners
            const newSearchButton = searchButton.cloneNode(true);
            searchButton.parentNode.replaceChild(newSearchButton, searchButton);
            
            // Add new listener
            newSearchButton.addEventListener('click', (e) => {
                console.log('Search button clicked');  // Debug log
                this.handleSearchFilters(e);
            });
        } else {
            console.error('Search button not found!');  // Error log
        }

        // Clear filters button
        const clearButton = document.getElementById('clear-filters');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearStructuredFilters());
        }
    },

    handleCategoryFilter(e) {
        e.preventDefault();
        e.stopPropagation();
        const category = e.target.dataset.category.toLowerCase(); // Ensure lowercase
        const button = e.target;

        console.log('Category clicked:', category);

        if (this.activeFilters.categories.has(category)) {
            this.activeFilters.categories.delete(category);
            button.classList.remove('border-blue-500', 'bg-blue-50');
        } else {
            this.activeFilters.categories.add(category);
            button.classList.add('border-blue-500', 'bg-blue-50');
        }

        console.log('Selected categories:', Array.from(this.activeFilters.categories));
    },

    handleMonthFilter(button) {
        const month = button.dataset.monthFilter;
        const monthButtons = document.querySelectorAll('[data-month-filter]');

        monthButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('border-gray-300', 'text-gray-700');
        });

        button.classList.add('bg-blue-600', 'text-white');
        button.classList.remove('border-gray-300', 'text-gray-700');

        if (month === 'todos') {
            this.activeFilters.months.clear();
        } else {
            this.activeFilters.months.clear();
            this.activeFilters.months.add(month);
        }
        // Do NOT call FilterModule.applyFilters() here
    },

    handleSearchFilters(e) {
        console.log('handleSearchFilters called');  // Debug log
        e.preventDefault();

        // Get all relevant elements
        const destacadosContainer = document.querySelector('.destacados-container');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');

        // Clear any active discipline filter first
        FilterModule.activeFilters.discipline = 'todos';
        FilterModule.updateDisciplineButtons();

        // Get current filter states
        const countryFilter = document.getElementById('country-filter');
        const monthFilter = document.getElementById('month-filter');
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');
        const hasActiveCategories = this.activeFilters.categories.size > 0;
        const hasActiveCountry = countryFilter && countryFilter.value;
        const hasActiveMonth = monthFilter && monthFilter.value;
        const hasFreeOnly = inscripcionCheckbox && inscripcionCheckbox.checked;

        // Always hide destacados section when structured search is used
        destacadosContainer?.classList.add('hidden');
        prevControl?.classList.add('hidden');
        nextControl?.classList.add('hidden');

        // Transfer active filters to the FilterModule
        FilterModule.activeFilters.categories.clear();
        if (hasActiveCategories) {
            this.activeFilters.categories.forEach(category => {
                FilterModule.activeFilters.categories.add(category.toLowerCase());
            });
        }

        // Transfer month filter
        FilterModule.activeFilters.month = hasActiveMonth ? monthFilter.value : '';
        console.log('Transferred month filter:', {
            hasActiveMonth,
            monthFilterValue: monthFilter?.value,
            transferredValue: FilterModule.activeFilters.month
        });

        // Transfer country filter
        FilterModule.activeFilters.country = hasActiveCountry ? countryFilter.value : '';
        console.log('Transferred country filter:', {
            hasActiveCountry,
            countryFilterValue: countryFilter?.value,
            transferredValue: FilterModule.activeFilters.country
        });
        
        // Transfer inscripcion filter
        FilterModule.activeFilters.freeOnly = hasFreeOnly;

        // Now perform the search
        FilterModule.applyFilters('', true);

        // Hide the structured filters dropdown
        const filtersElement = document.getElementById('structured-filters');
        if (filtersElement) {
            filtersElement.classList.add('hidden');
        }

        // Removed scrolling behavior: disabling scrollToResults function
        const scrollToResults = () => {};

        setTimeout(scrollToResults, 100);
    },

    clearStructuredFilters() {
        // Clear all active filters
        this.activeFilters.categories.clear();
        this.activeFilters.months.clear();
        this.activeFilters.countries.clear();

        // Reset UI
        document.querySelectorAll('[data-category-filter]').forEach(button => {
            button.classList.remove('border-blue-500', 'bg-blue-50');
        });

        document.querySelectorAll('[data-month-filter]').forEach(button => {
            button.classList.remove('bg-blue-600', 'text-white');
            button.classList.add('border-gray-300', 'text-gray-700');
        });

        // Reset dropdowns
        const countryFilter = document.getElementById('country-filter');
        const monthFilter = document.getElementById('month-filter');
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');
        
        if (countryFilter) countryFilter.value = '';
        if (monthFilter) monthFilter.value = '';
        if (inscripcionCheckbox) inscripcionCheckbox.checked = false;

        // Clear FilterModule filters and update results
        FilterModule.clearAllFilters();
    },

    attachSearchListeners() {
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');

        // Debug: Element check
        console.log('Search elements found:', {
            searchInput: !!searchInput,
            clearButton: !!clearButton
        });

        // Remove any existing listeners to prevent conflicts
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);

            // Add our listeners
            newSearchInput.addEventListener('input', () => this.performSearch());
            newSearchInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        }

        // Initial check for existing input
        if (searchInput?.value.length > 0) {
            clearButton.style.display = 'block';
        }
    },

    performSearch() {
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');
        const destacadosContainer = document.querySelector('.destacados-container');

        // Show/hide clear button based on input content
        if (searchInput.value.length > 0) {
            clearButton.style.display = 'block';
            destacadosContainer?.classList.add('hidden');
        } else {
            clearButton.style.display = 'none';
            if (!FilterModule.activeFilters.categories.size && 
                !FilterModule.activeFilters.country && 
                !FilterModule.activeFilters.month && 
                FilterModule.activeFilters.discipline === 'todos') {
                destacadosContainer?.classList.remove('hidden');
            }
        }

        const searchInputValue = searchInput.value;
        FilterModule.applyFilters(searchInputValue);

        // Track search if value is not empty
        if (searchInputValue.trim()) {
            this.trackSearch(searchInputValue);
        }
    },

    clearSearch() {
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');
        const destacadosContainer = document.querySelector('.destacados-container');
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');

        console.log('clearSearch called');

        searchInput.value = '';
        clearButton.style.display = 'none';
        
        // Reset inscripcion checkbox
        if (inscripcionCheckbox) {
            inscripcionCheckbox.checked = false;
        }
        FilterModule.activeFilters.freeOnly = false;
        
        // Show destacados section only if no other filters are active
        if (!FilterModule.activeFilters.categories.size && 
            !FilterModule.activeFilters.country && 
            !FilterModule.activeFilters.month && 
            FilterModule.activeFilters.discipline === 'todos') {
            destacadosContainer?.classList.remove('hidden');
        }
        
        this.performSearch(); // Trigger search to reset results

        // Replace current URL without query parameters
        history.replaceState(null, null, window.location.pathname);
    },

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.performSearch();
        }
    },

    trackSearch(searchTerm) {
        if (typeof gtag === "function") {
            gtag("event", "opportunity_search", {
                send_to: "G-36M4V4L5RX",
                search_term: searchTerm,
                search_type: "opportunity",
            });
        }
    },

    trackSearchError(searchTerm, errorType) {
        if (typeof gtag === "function") {
            gtag("event", "search_error", {
                search_term: searchTerm,
                error_type: errorType,
            });
        }
    },

    ensureClearButtonVisible() {
        const clearButton = document.getElementById('clear-search');
        if (clearButton) {
            clearButton.style.display = 'block';
            setTimeout(this.ensureClearButtonVisible.bind(this), 100);
        }
    },

    clearFilters() {
        // Clear internal state
        this.activeFilters.categories.clear();
        this.activeFilters.months.clear();
        this.activeFilters.countries.clear();

        // Update UI to reflect cleared state
        this.updateFilterUI();

        // Hide the structured filters dropdown
        const filtersElement = document.getElementById('structured-filters');
        if (filtersElement) {
            filtersElement.classList.add('hidden');
        }
    },

    handleStructuredSearch() {
        // Get the inscripcion checkbox state
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');
        const freeOnly = inscripcionCheckbox && inscripcionCheckbox.checked;
        
        // Get current filter states
        const countryFilter = document.getElementById('country-filter');
        const monthFilter = document.getElementById('month-filter');
        const hasActiveCategories = this.activeFilters.categories.size > 0;
        const hasActiveCountry = countryFilter && countryFilter.value;
        const hasActiveMonth = monthFilter && monthFilter.value;
        
        console.log('Structured search with categories:', Array.from(this.activeFilters.categories));
        
        // Transfer active filters to the FilterModule
        FilterModule.activeFilters.categories.clear();
        if (hasActiveCategories) {
            this.activeFilters.categories.forEach(category => {
                FilterModule.activeFilters.categories.add(category.toLowerCase());
            });
        }

        // Transfer month filter
        FilterModule.activeFilters.month = hasActiveMonth ? monthFilter.value : '';

        // Transfer country filter
        FilterModule.activeFilters.country = hasActiveCountry ? countryFilter.value : '';
        
        // Transfer inscripcion filter
        FilterModule.activeFilters.freeOnly = freeOnly;

        console.log('Applying structured search with filters:', {
            categories: Array.from(FilterModule.activeFilters.categories),
            country: FilterModule.activeFilters.country,
            month: FilterModule.activeFilters.month,
            freeOnly: FilterModule.activeFilters.freeOnly
        });
        
        // Perform the search
        FilterModule.applyFilters('', true);

        // Hide dropdown after search
        const filtersElement = document.getElementById('structured-filters');
        if (filtersElement) {
            filtersElement.classList.add('hidden');
        }

        // Scroll to results after filters are applied and DOM is updated
        setTimeout(() => {
            const resultsContainer = document.getElementById('results-container');
            if (resultsContainer) {
                resultsContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }, 100);
    },

    handleCategoryClick(category, element) {
        if (element.checked) {
            this.activeFilters.categories.add(category);
        } else {
            this.activeFilters.categories.delete(category);
        }

        this.updateFilterUI();
        console.log('Updated categories:', Array.from(this.activeFilters.categories));
    },

    sortResults(results, column) {
        if (!column || !this.sorting.active) return results;

        const sortFunctions = {
            nombre: (a, b) => {
                const aName = (a.nombre_original || '').toLowerCase();
                const bName = (b.nombre_original || '').toLowerCase();
                return aName.localeCompare(bName);
            },
            disciplina: (a, b) => {
                const aDisc = ((a.disciplina || '').split(',')[0] || '').toLowerCase().trim();
                const bDisc = ((b.disciplina || '').split(',')[0] || '').toLowerCase().trim();
                return aDisc.localeCompare(bDisc);
            },
            pais: (a, b) => {
                const aPais = (a.pais || a.país || '').toLowerCase();
                const bPais = (b.pais || b.país || '').toLowerCase();
                return aPais.localeCompare(bPais);
            },
            fecha: (a, b) => {
                const aDate = a.fecha_de_cierre === '1900-01-01' ? new Date(8640000000000000) : new Date(a.fecha_de_cierre);
                const bDate = b.fecha_de_cierre === '1900-01-01' ? new Date(8640000000000000) : new Date(b.fecha_de_cierre);
                return aDate - bDate;
            }
        };

        return [...results].sort(sortFunctions[column]);
    },

    handleSort(column) {
        if (this.sorting.column === column) {
            // Toggle active state if clicking the same column
            this.sorting.active = !this.sorting.active;
        } else {
            // New column, set to active
            this.sorting.column = column;
            this.sorting.active = true;
        }

        this.updateResults(this.pagination.allResults, true);
    },

    // Function to get sort icon
    getSortIcon(column) {
        const isActive = this.sorting.column === column && this.sorting.active;
        return `<svg class="w-4 h-4 ml-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
        </svg>`;
    },

    updateResults(results, preservePage = false) {
        const container = document.getElementById('results-container');
        const counter = document.getElementById('results-counter');

        if (!container || !counter) return;

        // Store all results for pagination
        this.pagination.allResults = results;
        this.pagination.totalPages = Math.ceil(results.length / this.pagination.itemsPerPage);
        
        if (!preservePage) {
            this.pagination.currentPage = 1;
        }

        container.className = '';

        if (!results.length) {
            container.innerHTML = '<p class="text-center text-gray-500 my-8">No se encontraron resultados.</p>';
            counter.textContent = '0 resultados encontrados';
            return;
        }

        // Sort results if a sort column is selected and active
        const sortedResults = this.sortResults(results, this.sorting.column);

        // Calculate pagination slice
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);

        // Function to format date
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr === '1900-01-01') {
                return 'Confirmar en bases';
            }
            try {
                const date = new Date(dateStr);
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

        // Create table with results
        container.innerHTML = `
            <div class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="results-table w-full table-fixed border-collapse">
                    <thead>
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="SearchModule.handleSort('nombre')">
                                <div class="flex items-center">
                                    Oportunidad
                                    ${this.getSortIcon('nombre')}
                                </div>
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="SearchModule.handleSort('disciplina')">
                                <div class="flex items-center">
                                    Disciplina
                                    ${this.getSortIcon('disciplina')}
                                </div>
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="SearchModule.handleSort('pais')">
                                <div class="flex items-center">
                                    País
                                    ${this.getSortIcon('pais')}
                                </div>
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                $
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="SearchModule.handleSort('fecha')">
                                <div class="flex items-center">
                                    Cierre
                                    ${this.getSortIcon('fecha')}
                                </div>
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${paginatedResults.map(page => `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 text-sm text-gray-900">
                                    ${Utils.escapeHTML(page.nombre_original || '')}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        ${Utils.escapeHTML(page.disciplina ? page.disciplina.split(',')[0].trim() : '')}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    ${Utils.escapeHTML(page.pais || page.país || '')}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                        '<div class="relative inline-block"><svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg><svg class="absolute top-0 left-0 w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="5" x2="19" y2="19"/></svg></div>' : 
                                        '<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg>'
                                    }
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    ${formatDate(page.fecha_de_cierre)}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    <button 
                                        type="button"
                                        class="preview-btn px-3 py-1 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
                                        data-url="${Utils.escapeHTML(page.url || '')}"
                                        data-nombre="${Utils.escapeHTML(page.nombre_original || '')}"
                                        data-pais="${Utils.escapeHTML(page.pais || page.país || '')}"
                                        data-og_resumida="${Utils.escapeHTML(page.og_resumida || '')}"
                                        data-id="${Utils.escapeHTML(page.id || '')}"
                                        data-categoria="${Utils.escapeHTML(page.categoria || '')}"
                                        data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}"
                                    >
                                        Ver
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.pagination.totalPages > 1 ? `
                <div class="flex justify-center mt-6">
                    <div class="flex items-center gap-2">
                        <button 
                            class="pagination-nav w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 ${this.pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                            ${this.pagination.currentPage === 1 ? 'disabled' : 'onclick="SearchModule.goToPage(' + (this.pagination.currentPage - 1) + ')"'}
                        >
                            ←
                        </button>
                        ${Array.from({ length: this.pagination.totalPages }, (_, i) => i + 1).map(pageNum => `
                            <button 
                                class="pagination-number w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium ${
                                    pageNum === this.pagination.currentPage 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-gray-700 hover:bg-gray-100'
                                }"
                                onclick="SearchModule.goToPage(${pageNum})"
                            >
                                ${pageNum}
                            </button>
                        `).join('')}
                        <button 
                            class="pagination-nav w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 ${this.pagination.currentPage === this.pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                            ${this.pagination.currentPage === this.pagination.totalPages ? 'disabled' : 'onclick="SearchModule.goToPage(' + (this.pagination.currentPage + 1) + ')"'}
                        >
                            →
                        </button>
                    </div>
                </div>
            ` : ''}
        `;

        counter.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
    },

    goToPage(page) {
        if (page < 1 || page > this.pagination.totalPages) return;
        this.pagination.currentPage = page;
        
        // Update the results with the new page
        this.updateResults(this.pagination.allResults, true);
        
        // Scroll to top of results
        document.getElementById('results-container')?.scrollIntoView({ behavior: 'smooth' });
    },
}; 