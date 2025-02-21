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
        itemsPerPage: 15,
        totalPages: 1,
        allResults: []
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

        // Clear any active discipline filter first
        FilterModule.activeFilters.discipline = 'todos';
        FilterModule.updateDisciplineButtons();

        // Transfer active filters to the FilterModule
        FilterModule.activeFilters.categories.clear();
        if (this.activeFilters.categories.size > 0) {
            this.activeFilters.categories.forEach(category => {
                FilterModule.activeFilters.categories.add(category.toLowerCase());
            });
        }

        // Transfer month filter
        FilterModule.activeFilters.month = '';
        if (this.activeFilters.months.size > 0) {
            const month = Array.from(this.activeFilters.months)[0];
            FilterModule.activeFilters.month = month;
        }

        // Transfer country filter
        const countryFilter = document.getElementById('country-filter');
        if (countryFilter && countryFilter.value) {
            FilterModule.activeFilters.country = countryFilter.value;
        }

        console.log('Applying structured filters:', {
            categories: Array.from(this.activeFilters.categories),
            country: FilterModule.activeFilters.country,
            month: FilterModule.activeFilters.month
        });

        // Now perform the search
        FilterModule.applyFilters();

        // Hide the structured filters dropdown
        const filtersElement = document.getElementById('structured-filters');
        if (filtersElement) {
            filtersElement.classList.add('hidden');
        }

        // Use a more robust approach to scrolling
        console.log('Scheduling scroll to results');  // Debug log
        const scrollToResults = () => {
            const resultsContainer = document.getElementById('results-container');
            console.log('Results container found:', !!resultsContainer);  // Debug log
            
            if (resultsContainer) {
                // First try with smooth scroll
                try {
                    resultsContainer.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    console.log('Smooth scroll executed');
                } catch (error) {
                    // Fallback to window.scrollTo if scrollIntoView fails
                    console.log('Falling back to window.scrollTo');
                    const rect = resultsContainer.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    window.scrollTo({
                        top: rect.top + scrollTop,
                        behavior: 'smooth'
                    });
                }
            }
        };

        // Try multiple times with increasing delays
        setTimeout(scrollToResults, 100);
        setTimeout(scrollToResults, 300);
        setTimeout(scrollToResults, 500);
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
        if (countryFilter) countryFilter.value = '';
        if (monthFilter) monthFilter.value = '';

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

        // Show/hide clear button based on input content
        if (searchInput.value.length > 0) {
            clearButton.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
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

        console.log('clearSearch called');

        searchInput.value = '';
        clearButton.style.display = 'none';
        this.performSearch(); // Trigger search to reset results

        // Replace current URL without query parameters
        history.replaceState(null, null, window.location.pathname);
    },

    handleKeyPress(event) {
        if (event.key === "Enter" && !this.searchInProgress) {
            event.preventDefault();
            const searchInput = document.getElementById("open-search");
            if (!searchInput) {
                console.error("Search input element not found!");
                return;
            }
            const searchValue = searchInput.value.trim();

            if (searchValue.length >= 3) {
                this.searchInProgress = true;
                this.trackSearch(searchValue);

                // Trigger the existing client-side filtering
                this.performSearch();

                // Smooth scroll after DOM update
                setTimeout(() => {
                    const resultsContainer = document.getElementById('results-container');
                    if (resultsContainer) {
                        resultsContainer.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                    this.searchInProgress = false;
                }, 100);  // Brief delay to allow DOM update
            }
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
        const filters = {
            categories: Array.from(this.activeFilters.categories),
            country: FilterModule.activeFilters.country,
            month: FilterModule.activeFilters.month
        };

        console.log('Applying structured search with filters:', filters);

        // Perform the search
        FilterModule.applyFilters();

        // Clear filters and update UI after search
        this.clearFilters();

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

    updateResults(results, preservePage = false) {
        const container = document.getElementById('results-container');
        const counter = document.getElementById('results-counter');

        if (!container || !counter) return;

        // Store all results for pagination
        this.pagination.allResults = results;
        this.pagination.totalPages = Math.ceil(results.length / this.pagination.itemsPerPage);
        
        // Only reset to first page when new results come in and preservePage is false
        if (!preservePage) {
            this.pagination.currentPage = 1;
        }

        // Remove any existing grid classes
        container.className = '';

        if (!results.length) {
            container.innerHTML = '<p class="text-center text-gray-500 my-8">No se encontraron resultados.</p>';
            counter.textContent = '0 resultados encontrados';
            return;
        }

        // Calculate pagination slice
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const paginatedResults = results.slice(startIndex, endIndex);

        // Create table with results
        container.innerHTML = `
            <div class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="results-table w-full table-fixed border-collapse">
                    <thead>
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                Oportunidad
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                Disciplina
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                País
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                $
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                Cierre
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${paginatedResults.map(page => `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 text-sm text-gray-900">
                                    ${Utils.escapeHTML(page.nombre || '')}
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
                                    ${page.tipo_de_pago || '-'}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    ${Utils.escapeHTML(page.fecha_de_cierre || '')}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">
                                    <button 
                                        class="preview-btn px-3 py-1 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
                                        data-url="${Utils.escapeHTML(page.url || '')}"
                                        data-name="${Utils.escapeHTML(page.nombre || '')}"
                                        data-pais="${Utils.escapeHTML(page.pais || page.país || '')}"
                                        data-og_resumida="${Utils.escapeHTML(page.og_resumida || '')}"
                                        data-id="${Utils.escapeHTML(page.id || '')}"
                                        data-categoria="${Utils.escapeHTML(page.categoria || '')}"
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
                        ${Array.from({ length: this.pagination.totalPages }, (_, i) => i + 1).map(pageNum => `
                            <button 
                                class="pagination-number w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                                    pageNum === this.pagination.currentPage 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-gray-700 hover:bg-gray-100'
                                }"
                                data-page="${pageNum}"
                            >
                                ${pageNum}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Attach event listeners to pagination buttons
        if (this.pagination.totalPages > 1) {
            container.querySelectorAll('.pagination-number').forEach(button => {
                button.addEventListener('click', (e) => {
                    const pageNum = parseInt(e.target.dataset.page);
                    this.goToPage(pageNum);
                });
            });
        }

        counter.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
    },

    goToPage(page) {
        if (page < 1 || page > this.pagination.totalPages) return;
        this.pagination.currentPage = page;
        
        // Update the results with the new page, preserving the current page
        this.updateResults(this.pagination.allResults, true);
        
        // Scroll to top of results
        document.getElementById('results-container')?.scrollIntoView({ behavior: 'smooth' });
    },
}; 