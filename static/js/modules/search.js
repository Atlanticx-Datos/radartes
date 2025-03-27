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
        countries: new Set(),
        subdisciplinas: new Set(),
        country: '',
        month: '',
        freeOnly: false
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1,
        allResults: []
    },
    sorting: {
        column: null,
        active: false
    },
    isFiltered: false,
    mobileSelectedColumn: 'disciplina', // Default selected column for mobile view

    init() {
        console.log('SearchModule initialized');
        
        // Initialize pagination
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 10,
            totalPages: 1,
            allResults: []
        };
        
        // Initialize sort column
        this.sortColumn = '';
        this.sortDirection = 'asc';
        
        // Store original order of results
        this.originalOrder = [];
        
        // Attach event listeners
        this.attachSearchListeners();
        
        // Apply table borders to any existing tables
        setTimeout(() => {
            this.applyTableBorders();
        }, 300);

        // Add window resize event listener for mobile adaptations
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        // Initialize mobile column visibility
        setTimeout(() => {
            this.handleWindowResize();
        }, 500);

        // Initialize with data from the page
        const preFilteredData = document.getElementById('prefiltered-data');
        if (preFilteredData) {
            console.log('SearchModule: Found prefiltered-data element');
            console.log('SearchModule: Data attributes:', {
                results: preFilteredData.dataset.results ? 'exists' : 'missing',
                pages: preFilteredData.dataset.pages ? 'exists' : 'missing'
            });
            
            try {
                const tempParser = new DOMParser();
                const pagesString = tempParser.parseFromString(preFilteredData.dataset.pages || '[]', 'text/html').body.textContent;
                console.log('SearchModule: Unescaped pages string length:', pagesString.length);
                
                const pages = JSON.parse(pagesString);
                console.log('SearchModule: Parsed pages count:', pages.length);

                console.log('Initializing search module with:', {
                    pageCount: pages.length,
                    firstPage: pages[0]
                });

                this.initializeStructuredFilters(pages);
                
                // Note: We don't apply any filtering on initialization
                // to ensure all pages are shown initially
                
                // Add single event listener for preview buttons using event delegation
                document.addEventListener('click', (e) => {
                    const previewButton = e.target.closest('.preview-btn, .action-button');
                    if (!previewButton) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const dataset = previewButton.dataset;
                    console.log('Preview button clicked, data:', dataset);
                    console.log('Preview button element:', {
                        element: previewButton,
                        classList: previewButton.classList,
                        dataset: previewButton.dataset
                    });
                    
                    if (window.ModalModule && window.ModalModule.showPreviewModal) {
                        console.log('Search module preview button click data:', dataset);
                        window.ModalModule.showPreviewModal(
                            dataset.url,
                            dataset.nombre || dataset.name,
                            dataset.pais || dataset.country,
                            dataset.og_resumida || dataset.summary,
                            dataset.id,
                            dataset.categoria || dataset.category,
                            dataset.baseUrl || dataset.base_url || (dataset.url && dataset.url.startsWith('http') ? dataset.url : null),
                            dataset.requisitos,
                            dataset.disciplina,
                            dataset.fecha_cierre || dataset.fechaCierre,
                            dataset.inscripcion
                        );
                    } else {
                        console.error('ModalModule not found or showPreviewModal not available');
                    }
                });
            } catch (e) {
                console.error('Search module initialization error:', e);
            }
        }

        this.updateFilterUI();
        
        // Ensure clear button visibility is correct on initialization
        this.ensureClearButtonVisible();

        // Initialize sorting state
        this.sortColumn = null;
        this.sortActive = false;
        this.originalOrder = []; // Store original order of results
        
        // Remove any old sorting properties if they exist
        if (this.sorting) {
            delete this.sorting;
        }
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
            // Handle both pais and país variations
            const uniqueCountries = [...new Set(pages
                .map(p => p.pais || p.país || '')
                .filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'es'));

            console.log('Unique countries for dropdown:', uniqueCountries);

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
        const destacadosSection = document.querySelector('.destacados-section');
        const featuredOpportunities = document.querySelector('.featured-opportunities');
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
        destacadosSection?.classList.add('hidden');
        featuredOpportunities?.classList.add('hidden');
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

        // Now perform the search with scrolling enabled
        FilterModule.applyFilters('', true);

        // Hide the structured filters dropdown
        const filtersElement = document.getElementById('structured-filters');
        if (filtersElement) {
            filtersElement.classList.add('hidden');
        }
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
            newSearchInput.addEventListener('input', () => {
                this.performSearch();
                this.ensureClearButtonVisible();
            });
            newSearchInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        }

        // Initial check for existing input
        if (searchInput?.value.trim().length > 0) {
            this.ensureClearButtonVisible();
        } else {
            // Make sure the clear button is hidden and filter trigger is positioned correctly on page load
            const filterTrigger = document.getElementById('filter-dropdown-trigger');
            if (clearButton) {
                clearButton.classList.add('hidden');
                clearButton.style.display = 'none';
            }
            if (filterTrigger) {
                filterTrigger.classList.remove('right-12');
                filterTrigger.classList.add('right-4');
            }
        }
    },

    performSearch(shouldScroll = false) {
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');
        const destacadosContainer = document.querySelector('.destacados-container');
        const destacadosSection = document.querySelector('.destacados-section');
        const featuredOpportunities = document.querySelector('.featured-opportunities');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');

        // Always show the clear button
        if (clearButton) {
            clearButton.style.display = 'block';
        }

        // Hide destacados container if there's search input
        if (searchInput.value.length > 0) {
            destacadosContainer?.classList.add('hidden');
            destacadosSection?.classList.add('hidden');
            featuredOpportunities?.classList.add('hidden');
            prevControl?.classList.add('hidden');
            nextControl?.classList.add('hidden');
        } else {
            if (!FilterModule.activeFilters.categories.size && 
                !FilterModule.activeFilters.country && 
                !FilterModule.activeFilters.month && 
                FilterModule.activeFilters.discipline === 'todos') {
                destacadosContainer?.classList.remove('hidden');
                destacadosSection?.classList.remove('hidden');
                featuredOpportunities?.classList.remove('hidden');
                prevControl?.classList.remove('hidden');
                nextControl?.classList.remove('hidden');
            }
        }

        const searchInputValue = searchInput.value;
        
        // Set the isFiltered flag if there's a search input or any filters are active
        this.isFiltered = searchInputValue.trim().length > 0 || 
                         FilterModule.activeFilters.categories.size > 0 || 
                         FilterModule.activeFilters.country || 
                         FilterModule.activeFilters.month || 
                         FilterModule.activeFilters.discipline !== 'todos' ||
                         FilterModule.activeFilters.freeOnly;
        
        console.log('Search is filtered:', this.isFiltered);
        
        FilterModule.applyFilters(searchInputValue, false);

        // Directly handle scrolling here if requested
        if (shouldScroll && FilterModule.lastFilteredResults && FilterModule.lastFilteredResults.length > 0) {
            this.scrollToResults();
        }

        // Ensure the clear button visibility is correct
        this.ensureClearButtonVisible();

        // Track search if value is not empty
        if (searchInputValue.trim()) {
            this.trackSearch(searchInputValue);
        }
    },

    clearSearch() {
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');
        const filterTrigger = document.getElementById('filter-dropdown-trigger');
        const destacadosContainer = document.querySelector('.destacados-container');
        const destacadosSection = document.querySelector('.destacados-section');
        const featuredOpportunities = document.querySelector('.featured-opportunities');
        const prevControl = document.querySelector('.destacar-prev');
        const nextControl = document.querySelector('.destacar-next');
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');

        // Reset search input
        if (searchInput) {
            searchInput.value = '';
        }

        // Hide clear button
        if (clearButton) {
            clearButton.classList.add('hidden');
            clearButton.style.display = 'none';
        }

        // Reset filter trigger position
        if (filterTrigger) {
            filterTrigger.classList.remove('right-12');
            filterTrigger.classList.add('right-4');
        }

        // Show destacados container
        if (destacadosContainer) {
            destacadosContainer.classList.remove('hidden');
        }
        if (destacadosSection) {
            destacadosSection.classList.remove('hidden');
        }
        if (featuredOpportunities) {
            featuredOpportunities.classList.remove('hidden');
        }
        if (prevControl) {
            prevControl.classList.remove('hidden');
        }
        if (nextControl) {
            nextControl.classList.remove('hidden');
        }

        // Reset inscripcion checkbox
        if (inscripcionCheckbox) inscripcionCheckbox.checked = false;

        // Reset isFiltered flag
        this.isFiltered = false;
        console.log('Search cleared, isFiltered reset to false');

        // Clear FilterModule filters and update results
        FilterModule.clearAllFilters();
    },

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            // Pass true to performSearch to indicate scrolling should happen
            this.performSearch(true);
        }
    },

    trackSearch(searchTerm) {
        if (typeof gtag === "function") {
            gtag("event", "opportunity_search", {
                send_to: "G-TTXJE3WXKC",
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
        const searchInput = document.getElementById('open-search');
        const clearButton = document.getElementById('clear-search');
        const filterTrigger = document.getElementById('filter-dropdown-trigger');
        
        if (searchInput && clearButton && filterTrigger) {
            if (searchInput.value.trim() !== '') {
                // Show clear button and move filter trigger to the left
                clearButton.classList.remove('hidden');
                clearButton.style.display = 'block';
                filterTrigger.classList.remove('right-4');
                filterTrigger.classList.add('right-12');
            } else {
                // Hide clear button and move filter trigger back to the right
                clearButton.classList.add('hidden');
                clearButton.style.display = 'none';
                filterTrigger.classList.remove('right-12');
                filterTrigger.classList.add('right-4');
            }
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

    /**
     * Handles the structured search functionality
     * This is triggered when the user clicks the "Buscar" button in the structured filters dropdown
     * @param {boolean} shouldScroll - Whether to scroll to results after search (defaults to true)
     */
    handleStructuredSearch(shouldScroll = true) {
        console.log('Handling structured search...');
        
        try {
            // Get the prefiltered data
            const prefilteredData = document.getElementById('prefiltered-data');
            if (!prefilteredData || !prefilteredData.dataset.pages) {
                console.error('No prefiltered data found');
                return;
            }
            
            // Helper function to decode HTML entities
            const decodeHtmlEntities = (html) => {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = html;
                return textarea.value;
            };
            
            // Try to parse the data, handling potential HTML-escaped JSON
            let pages;
            try {
                // First try direct parsing
                pages = JSON.parse(prefilteredData.dataset.pages);
            } catch (e) {
                console.warn('Failed to parse JSON directly, trying to decode HTML entities first:', e);
                try {
                    // If that fails, try decoding HTML entities first
                    const decoded = decodeHtmlEntities(prefilteredData.dataset.pages);
                    pages = JSON.parse(decoded);
                } catch (e2) {
                    console.error('Failed to parse JSON even after decoding HTML entities:', e2);
                    return;
                }
            }
            
            console.log(`Initial pages count: ${pages.length}`);
            console.log('Active filters:', {
                categories: Array.from(this.activeFilters.categories),
                subdisciplinas: Array.from(this.activeFilters.subdisciplinas),
                country: this.activeFilters.country,
                month: this.activeFilters.month,
                freeOnly: this.activeFilters.freeOnly
            });
            
            // Filter by categories
            if (this.activeFilters.categories.size > 0) {
                console.log(`Filtering by categories: ${Array.from(this.activeFilters.categories).join(', ')}`);
                pages = pages.filter(page => {
                    // Check the categoria field (not disciplina)
                    if (!page.categoria) return false;
                    
                    // Normalize the categoria for comparison using FilterModule's normalizeText
                    const normalizedCategoria = FilterModule.normalizeText(page.categoria);
                    
                    // Check if any of the selected categories match
                    return Array.from(this.activeFilters.categories).some(category => {
                        const normalizedCategory = FilterModule.normalizeText(category);
                        return normalizedCategoria.includes(normalizedCategory);
                    });
                });
                console.log(`After category filtering: ${pages.length} pages`);
            }
            
            // Filter by subdisciplinas
            if (this.activeFilters.subdisciplinas.size > 0) {
                console.log(`Filtering by subdisciplinas: ${Array.from(this.activeFilters.subdisciplinas).join(', ')}`);
                pages = pages.filter(page => {
                    if (!page.disciplina) return false;
                    
                    // Get all subdisciplines (after the first comma)
                    const parts = page.disciplina.split(',');
                    if (parts.length <= 1) return false;
                    
                    const subdisciplinas = parts.slice(1).map(sub => sub.trim());
                    return subdisciplinas.some(sub => this.activeFilters.subdisciplinas.has(sub));
                });
                console.log(`After subdisciplina filtering: ${pages.length} pages`);
            }
            
            // Filter by country
            if (this.activeFilters.country && this.activeFilters.country.length > 0) {
                console.log(`Filtering by countries: ${this.activeFilters.country.join(', ')}`);
                pages = pages.filter(page => {
                    // Check both país and pais fields
                    const country = page.país || page.pais;
                    return this.activeFilters.country.includes(country);
                });
                console.log(`After country filtering: ${pages.length} pages`);
            }
            
            // Filter by month
            if (this.activeFilters.month && this.activeFilters.month.length > 0) {
                console.log(`Filtering by months: ${this.activeFilters.month.join(', ')}`);
                pages = pages.filter(page => {
                    if (!page.fecha_de_cierre) return false;
                    
                    try {
                        // Parse the date
                        const date = new Date(page.fecha_de_cierre);
                        // Get the month name in Spanish
                        const monthName = this.getMonthName(date.getMonth());
                        
                        console.log(`Page ${page.nombre}: fecha_de_cierre=${page.fecha_de_cierre}, month=${monthName}`);
                        
                        return this.activeFilters.month.includes(monthName);
                    } catch (e) {
                        console.error(`Error parsing date for page ${page.nombre}:`, e);
                        return false;
                    }
                });
                console.log(`After month filtering: ${pages.length} pages`);
            }
            
            // Filter by free only
            if (this.activeFilters.freeOnly) {
                console.log('Filtering by free only');
                pages = pages.filter(page => {
                    // Check if inscripcion is empty or contains "sin pago" or similar
                    return !page.inscripcion || 
                           page.inscripcion.toLowerCase().includes('sin pago') || 
                           page.inscripcion.toLowerCase().includes('gratis') ||
                           page.inscripcion.toLowerCase().includes('gratuito');
                });
                console.log(`After free only filtering: ${pages.length} pages`);
            }
            
            // Update the results
            this.updateResults(pages);
            
            // Scroll to results only if shouldScroll is true
            if (shouldScroll) {
                this.scrollToResults();
            }
            
        } catch (error) {
            console.error('Error in handleStructuredSearch:', error);
        }
    },

    getMonthName(monthIndex) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[monthIndex];
    },

    updateResults(results, preservePage = false) {
        // Filter out opportunities with past closing dates
        results = results.filter(page => {
            // Skip filtering if no closing date or it's the placeholder date
            if (!page.fecha_de_cierre || page.fecha_de_cierre === '1900-01-01') {
                return true;
            }
            
            // Get today's date in YYYY-MM-DD format, using UTC to match backend logic
            const today = new Date();
            const todayStr = today.getUTCFullYear() + '-' + 
                            String(today.getUTCMonth() + 1).padStart(2, '0') + '-' + 
                            String(today.getUTCDate()).padStart(2, '0');
            
            // Compare dates as strings (works for YYYY-MM-DD format)
            const isNotExpired = page.fecha_de_cierre >= todayStr;
            
            if (!isNotExpired) {
                console.log(`Filtering out expired opportunity: ${page.nombre} - Closing date: ${page.fecha_de_cierre} is before today (${todayStr})`);
            }
            
            return isNotExpired;
        });
        
        // Store original order only on first load with all results
        if (!this.originalOrder.length && results.length > 0 && !this.isFiltered) {
            console.log('Storing original order with', results.length, 'items');
            this.originalOrder = [...results];
        }
        
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

        // Update the counter with a trash icon for global clear
        counter.innerHTML = `
            <div class="flex justify-between items-center w-full" style="height: 21px; padding: 24px 0;">
                <div style="line-height: 21px;">
                    ${results.length === 0 
                        ? '0 resultados encontrados' 
                        : `Mostrando ${(this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1}-${Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, results.length)} de ${results.length} resultado${results.length !== 1 ? 's' : ''}`
                    }
                </div>
                
                <!-- Mobile Column Selector -->
                <div class="mobile-column-selector">
                    <label for="mobile-column-select">Mostrar columna:</label>
                    <select id="mobile-column-select" onchange="SearchModule.handleMobileColumnChange(this.value)">
                        <option value="disciplina" ${this.mobileSelectedColumn === 'disciplina' ? 'selected' : ''}>Disciplina</option>
                        <option value="pais" ${this.mobileSelectedColumn === 'pais' ? 'selected' : ''}>País</option>
                        <option value="cierre" ${this.mobileSelectedColumn === 'cierre' ? 'selected' : ''}>Cierre</option>
                        <option value="pago" ${this.mobileSelectedColumn === 'pago' ? 'selected' : ''}>Pago</option>
                    </select>
                </div>
                
                <button 
                    type="button" 
                    class="trash-icon-container" 
                    onclick="SearchModule.clearSearch();"
                    title="Limpiar búsqueda y filtros"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="trash-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        `;

        if (!results.length) {
            container.innerHTML = '<p class="text-center text-gray-500 my-8">No se encontraron resultados.</p>';
            return;
        }

        // Sort results if a sort column is selected and active
        const sortedResults = this.sortResults(results, this.sortColumn);
        
        // Log the number of results before and after sorting
        console.log(`Results before sorting: ${results.length}, after sorting: ${sortedResults.length}`);

        // Calculate pagination slice
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);
        
        // Log the number of paginated results
        console.log(`Paginated results: ${paginatedResults.length} (page ${this.pagination.currentPage} of ${this.pagination.totalPages})`);

        // Function to format date
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr === '1900-01-01') {
                return 'Confirmar en bases';
            }
            
            // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
            if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.log('Using timezone-safe parsing for YYYY-MM-DD format in search.js');
                const [year, month, day] = dateStr.split('-').map(Number);
                
                // Month is 0-indexed in JavaScript Date
                const monthIndex = month - 1;
                
                const monthMap = {
                    0: 'Ene', 1: 'Feb', 2: 'Mar', 3: 'Abr', 4: 'May', 5: 'Jun',
                    6: 'Jul', 7: 'Ago', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dic'
                };
                
                // Format with day zero-padded
                const formattedDay = String(day).padStart(2, '0');
                return `${formattedDay} ${monthMap[monthIndex]} ${year}`;
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
                return `${day} ${monthMap[date.getMonth()]} ${year}`;
            } catch (e) {
                return dateStr;
            }
        };

        // Create table with results
        container.innerHTML = `
            <div class="results-table-container overflow-x-auto" style="border: 2px solid #6232FF !important; box-shadow: none !important; border-radius: 8px !important;">
                <table class="results-table min-w-full" style="border-collapse: collapse !important;">
                    <thead style="background-color: #6232FF !important; color: white !important; border-bottom: 1px solid #6232FF !important;">
                        <tr>
                            <th scope="col" class="oportunidad-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" onclick="SearchModule.handleSort('nombre')" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                <div class="flex items-center">
                                    OPORTUNIDAD
                                    ${this.getSortIcon('nombre')}
                                </div>
                            </th>
                            <th scope="col" class="disciplina-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" onclick="SearchModule.handleSort('disciplina')" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                <div class="flex items-center">
                                    DISCIPLINA
                                    ${this.getSortIcon('disciplina')}
                                </div>
                            </th>
                            <th scope="col" class="pais-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer" onclick="SearchModule.handleSort('pais')" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                <div class="flex items-center">
                                    PAÍS
                                    ${this.getSortIcon('pais')}
                                </div>
                            </th>
                            <th scope="col" class="cierre-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                CIERRE
                            </th>
                            <th scope="col" class="pago-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                PAGO
                            </th>
                            <th scope="col" class="accion-col px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style="color: white !important; padding: 12px 16px; font-weight: 600; font-size: 14px; border: none !important;">
                                ACCIÓN
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedResults.length > 0 ? paginatedResults.map((page, index) => {
                            // Get the first discipline for the tag
                            const mainDiscipline = page.disciplina ? page.disciplina.split(',')[0].trim().toLowerCase() : '';
                            
                            // Normalize the discipline name for class
                            const normalizedDiscipline = mainDiscipline
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .replace(/\s+/g, '');
                            
                            // Define color mappings for each discipline
                            const disciplineColors = {
                                'visuales': { bg: '#FDE8EB', text: '#E92E4A' },
                                'musica': { bg: '#FFF0E8', text: '#FF7022' },
                                'escenicas': { bg: '#FFFBE8', text: '#F3CE3A' },
                                'literatura': { bg: '#E8F9FF', text: '#2ED0FF' },
                                'diseno': { bg: '#E8F6F5', text: '#17A398' },
                                'cine': { bg: '#F0E8EC', text: '#64113F' },
                                'otros': { bg: '#FCE8F4', text: '#F15BB5' }
                            };
                            
                            // Get colors for this discipline
                            const colors = disciplineColors[normalizedDiscipline] || disciplineColors['otros'];
                            
                            return `
                            <tr style="border-bottom: 1px solid #6232FF !important; background-color: ${index % 2 === 0 ? 'white' : '#f9fafb'}; cursor: pointer;" 
                                onclick="showOpportunityDetails(this, event)" 
                                data-url="${Utils.escapeHTML(page.url || '')}"
                                data-base-url="${Utils.escapeHTML(page.base_url || '')}"
                                data-nombre="${Utils.escapeHTML(page.nombre || '')}"
                                data-pais="${Utils.escapeHTML(page.pais || page.país || '')}"
                                data-og-resumida="${Utils.escapeHTML(page.og_resumida || '')}"
                                data-id="${Utils.escapeHTML(page.id || '')}"
                                data-categoria="${Utils.escapeHTML(page.categoria || '')}"
                                data-requisitos="${Utils.escapeHTML(page.requisitos || '')}"
                                data-disciplina="${Utils.escapeHTML(page.disciplina || '')}"
                                data-fecha-cierre="${Utils.escapeHTML(page.fecha_de_cierre || '')}"
                                data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}">
                                <td class="oportunidad-col px-4 py-4 whitespace-nowrap" style="border: none !important;">
                                    <div class="text-sm font-medium text-gray-900">
                                        ${this.formatTitleWithCategory(page.nombre || '')}
                                    </div>
                                </td>
                                <td class="disciplina-col px-4 py-4 whitespace-nowrap" style="border: none !important;">
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm" 
                                          style="background-color: ${colors.bg}; color: ${colors.text}; font-weight: 500;">
                                        ${mainDiscipline.charAt(0).toUpperCase() + mainDiscipline.slice(1)}
                                    </span>
                                </td>
                                <td class="pais-col px-4 py-4 whitespace-nowrap text-sm text-gray-900" style="border: none !important;">
                                    ${page.pais || page.país || ''}
                                </td>
                                <td class="cierre-col px-4 py-4 whitespace-nowrap text-sm text-gray-900" style="border: none !important;">
                                    ${formatDate(page.fecha_de_cierre)}
                                </td>
                                <td class="pago-col px-4 py-4 whitespace-nowrap" style="border: none !important;">
                                    ${page.inscripcion === 'Sin cargo' || !page.inscripcion ? 
                                        '<div class="flex justify-center"><img src="/static/public/icons/money_off.svg" alt="No payment required" class="w-4 h-4" style="color: #1F1B2D;" /></div>' : 
                                        '<div class="flex justify-center"><img src="/static/public/icons/money_on.svg" alt="Payment required" class="w-4 h-4" style="color: #1F1B2D;" /></div>'
                                    }
                                </td>
                                <td class="accion-col px-4 py-4 whitespace-nowrap text-right text-sm font-medium" style="border: none !important;">
                                    <button 
                                        class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                                        style="background-color: #F0EBFF; color: #6232FF;"
                                        data-url="${page.url || ''}"
                                        data-base-url="${Utils.escapeHTML(page.base_url || '')}"
                                        data-nombre="${Utils.escapeHTML(page.nombre_original || page.nombre || '')}"
                                        data-pais="${Utils.escapeHTML(page.pais || page.país || '')}"
                                        data-og-resumida="${Utils.escapeHTML(page.og_resumida || '')}"
                                        data-id="${page.id || ''}"
                                        data-categoria="${Utils.escapeHTML(page.categoria || '')}"
                                        data-requisitos="${Utils.escapeHTML(page.requisitos || '')}"
                                        data-disciplina="${Utils.escapeHTML(page.disciplina || '')}"
                                        data-fecha-cierre="${page.fecha_de_cierre || ''}"
                                        data-inscripcion="${Utils.escapeHTML(page.inscripcion || '')}"
                                        onclick="window.showOpportunityDetails(this, event)"
                                    >
                                        Ver
                                    </button>
                                </td>
                            </tr>
                            `;
                        }).join('') : `
                            <tr style="border-bottom: 1px solid #6232FF !important;">
                                <td colspan="6" class="px-4 py-4 text-center text-gray-500" style="border: none !important;">
                                    No se encontraron resultados para tu búsqueda.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            ${this.pagination.totalPages > 1 ? `
                <div class="pagination-container mt-0 flex items-center justify-end">
                    <!-- Combined rows per page and page counter -->
                    <div class="flex items-center justify-center pagination-info-container">
                        <!-- Results per page dropdown with label -->
                        <div class="flex items-center">
                            <span class="pagination-label mr-2">Filas por página:</span>
                            <select id="results-per-page" class="form-select-clean" onchange="SearchModule.changeResultsPerPage(this.value)">
                                <option value="10" ${this.pagination.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${this.pagination.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                <option value="50" ${this.pagination.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${this.pagination.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                            </select>
                        </div>
                        
                        <!-- Page counter -->
                        <div class="pagination-counter">
                            Página ${this.pagination.currentPage} de ${this.pagination.totalPages}
                        </div>
                    </div>
                    
                    <!-- Navigation buttons -->
                    <div class="flex items-center pagination-nav-container">
                        <!-- Previous page button -->
                        <button 
                            class="pagination-nav flex items-center justify-center ${this.pagination.currentPage === 1 ? 'disabled' : ''}"
                            ${this.pagination.currentPage === 1 ? 'disabled' : 'onclick="SearchModule.goToPage(' + (this.pagination.currentPage - 1) + ')"'}
                            title="Página anterior"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        
                        <!-- Next page button -->
                        <button 
                            class="pagination-nav flex items-center justify-center ml-2 ${this.pagination.currentPage === this.pagination.totalPages ? 'disabled' : ''}"
                            ${this.pagination.currentPage === this.pagination.totalPages ? 'disabled' : 'onclick="SearchModule.goToPage(' + (this.pagination.currentPage + 1) + ')"'}
                            title="Página siguiente"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            ` : ''}
        `;

        // Apply our custom styles to the results table
        setTimeout(() => {
            console.log('Applying direct styles to search results table');
            
            // First, remove problematic classes from header cells
            const headerCells = document.querySelectorAll('.results-table th, table[id*="results"] th');
            headerCells.forEach(cell => {
                // Remove Tailwind background classes that might be interfering
                cell.classList.remove('bg-gray-50', 'hover:bg-gray-100');
                
                // Add our own class for styling
                cell.classList.add('results-header-cell');
                
                // Apply direct styles that will override any other styles
                cell.style.backgroundColor = '#6232FF';
                cell.style.color = 'white';
                cell.style.padding = '12px 16px';
                cell.style.fontWeight = '600';
                cell.style.fontSize = '14px';
            });
            
            // Apply styles to the thead element
            const tableHeaders = document.querySelectorAll('.results-table thead, table[id*="results"] thead');
            tableHeaders.forEach(header => {
                // Remove any background classes
                header.classList.remove('bg-gray-50');
                
                // Apply direct styles
                header.style.backgroundColor = '#6232FF';
                header.style.color = 'white';
            });
            
            // Fix the sort icons in the header
            const sortIcons = document.querySelectorAll('.results-table th svg, table[id*="results"] th svg');
            sortIcons.forEach(icon => {
                icon.style.color = 'white';
                icon.classList.remove('text-gray-400');
                icon.classList.add('text-white');
            });
            
            console.log('Applied custom styles to search results table');
        }, 100); // Small delay to ensure the DOM is updated

        // After rendering the table, apply primary color borders
        setTimeout(() => {
            this.applyTableBorders();
        }, 100);

        // After rendering the table, apply mobile column visibility
        setTimeout(() => {
            this.handleMobileColumnChange(this.mobileSelectedColumn);
        }, 200);
    },

    goToPage(page) {
        if (page < 1 || page > this.pagination.totalPages) return;
        this.pagination.currentPage = page;
        
        // Update the results with the new page
        this.updateResults(this.pagination.allResults, true);
        
        // No scrolling when navigating between pages
    },

    // Function to scroll to results with some white space above the radar header
    scrollToResults() {
        console.log('Scrolling to radar header');
        const radarHeader = document.getElementById('radar-header');
        
        if (radarHeader) {
            // Get the position of the header
            const headerRect = radarHeader.getBoundingClientRect();
            const absoluteHeaderTop = headerRect.top + window.pageYOffset;
            
            // Scroll to a position 50px above the header for some breathing space
            window.scrollTo({
                top: absoluteHeaderTop - 50,
                behavior: 'smooth'
            });
            
            console.log('Scrolled to radar header with offset');
        } else {
            // Fallback to the results container if the header is not found
            console.warn('Radar header not found, falling back to results container');
            const resultsContainer = document.getElementById('results-container');
            
            if (resultsContainer) {
                resultsContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start'
                });
            } else {
                console.warn('Results container not found for scrolling');
            }
        }
    },

    sortResults(results, column) {
        // If sorting is not active, return the filtered results as is
        if (!this.sortActive || !column) {
            return results;
        }

        // Sort if active
        const sortFunctions = {
            nombre: (a, b) => {
                const aName = FilterModule.normalizeText(a.nombre || '');
                const bName = FilterModule.normalizeText(b.nombre || '');
                return aName.localeCompare(bName);
            },
            disciplina: (a, b) => {
                const aDisc = FilterModule.normalizeText((a.disciplina || '').split(',')[0] || '');
                const bDisc = FilterModule.normalizeText((b.disciplina || '').split(',')[0] || '');
                return aDisc.localeCompare(bDisc);
            },
            pais: (a, b) => {
                const aPais = FilterModule.normalizeText(a.pais || a.país || '');
                const bPais = FilterModule.normalizeText(b.pais || b.país || '');
                return aPais.localeCompare(bPais);
            },
            fecha: (a, b) => {
                // Special handling for dates
                // Convert '1900-01-01' to a far future date for sorting purposes
                const parseDate = (dateStr) => {
                    if (!dateStr || dateStr === '1900-01-01') {
                        return new Date(8640000000000000); // Far future date
                    }
                    
                    // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
                    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        console.log('Using timezone-safe parsing for YYYY-MM-DD format in parseDate');
                        const [year, month, day] = dateStr.split('-').map(Number);
                        
                        // Get today's date in UTC for comparison
                        const today = new Date();
                        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                        
                        // Create date with the parts using UTC to avoid timezone issues
                        const date = new Date(Date.UTC(year, month - 1, day));
                        
                        // Ensure opportunities that have already passed show up sorted AFTER future ones
                        // by returning a far future date for past opportunities
                        if (date < todayUTC) {
                            console.log(`Date ${dateStr} has passed, treating as far future for sorting`);
                            return new Date(8640000000000000);
                        }
                        
                        return date;
                    }
                    
                    return new Date(dateStr);
                };
                
                const aDate = parseDate(a.fecha_de_cierre);
                const bDate = parseDate(b.fecha_de_cierre);
                
                // Compare dates
                return aDate - bDate;
            }
        };
        
        return [...results].sort(sortFunctions[column]);
    },

    handleSort(column) {
        console.log('Handling sort for column:', column);
        console.log('Current sort state:', { column: this.sortColumn, active: this.sortActive });
        
        if (this.sortColumn === column) {
            // Toggle active state if clicking the same column
            this.sortActive = !this.sortActive;
        } else {
            // New column, set to active
            this.sortColumn = column;
            this.sortActive = true;
        }
        
        console.log('New sort state:', { column: this.sortColumn, active: this.sortActive });

        // Get the results to display
        let resultsToDisplay;
        if (this.sortActive) {
            // Sort the results if active
            resultsToDisplay = this.sortResults(this.pagination.allResults, column);
        } else {
            // Use original order if not active
            resultsToDisplay = this.originalOrder.length > 0 ? [...this.originalOrder] : this.pagination.allResults;
        }
        
        // Update the display with sorted or original results
        this.updateResults(resultsToDisplay, true);
    },

    // Function to get sort icon
    getSortIcon(column) {
        // Always use the arrows icon, but change opacity if active
        const isActive = this.sortColumn === column && this.sortActive;
        // Use the external SVG file which is now white
        return `<img src="/static/public/icons/arrows-sort.svg" class="w-4 h-4 ml-1" style="opacity: ${isActive ? '1' : '0.7'}">`;
    },

    // Function to render page numbers with ellipsis for many pages
    renderPageNumbers() {
        const { currentPage, totalPages } = this.pagination;
        const maxVisiblePages = 10; // Maximum number of page buttons to show
        
        // If we have fewer pages than the max visible, just show all pages
        if (totalPages <= maxVisiblePages) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
                .map(pageNum => this.renderPageButton(pageNum))
                .join('');
        }
        
        // Otherwise, we need to show a subset with ellipsis
        const pages = [];
        
        // Always show first page
        pages.push(this.renderPageButton(1));
        
        // Calculate range of pages to show around current page
        let rangeStart = Math.max(2, currentPage - Math.floor((maxVisiblePages - 2) / 2));
        let rangeEnd = Math.min(totalPages - 1, rangeStart + maxVisiblePages - 3);
        
        // Adjust range if we're near the end
        if (rangeEnd >= totalPages - 1) {
            rangeStart = Math.max(2, totalPages - maxVisiblePages + 2);
            rangeEnd = totalPages - 1;
        }
        
        // Add ellipsis before range if needed
        if (rangeStart > 2) {
            pages.push('<span class="w-8 h-8 flex items-center justify-center">…</span>');
        }
        
        // Add range of pages
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(this.renderPageButton(i));
        }
        
        // Add ellipsis after range if needed
        if (rangeEnd < totalPages - 1) {
            pages.push('<span class="w-8 h-8 flex items-center justify-center">…</span>');
        }
        
        // Always show last page
        pages.push(this.renderPageButton(totalPages));
        
        return pages.join('');
    },
    
    // Helper to render a single page button
    renderPageButton(pageNum) {
        const isActive = pageNum === this.pagination.currentPage;
        return `
            <button 
                class="pagination-number w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium ${
                        isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }"
                onclick="SearchModule.goToPage(${pageNum})"
            >
                ${pageNum}
            </button>
        `;
    },

    // Function to change the number of results per page
    changeResultsPerPage(value) {
        // Convert value to number
        const newItemsPerPage = parseInt(value, 10);
        
        // Update pagination settings
        this.pagination.itemsPerPage = newItemsPerPage;
        this.pagination.totalPages = Math.ceil(this.pagination.allResults.length / newItemsPerPage);
        
        // Reset to first page when changing items per page
        this.pagination.currentPage = 1;
        
        // Update the results with the new pagination settings
        this.updateResults(this.pagination.allResults, true);
    },

    applyTableBorders() {
        // Apply primary color borders to all table elements
        const tables = document.querySelectorAll('.results-table, #results-container table, [id*="results"] table');
        tables.forEach(table => {
            table.style.borderCollapse = 'collapse';
            
            // Apply styles to table container
            const container = table.closest('.results-table-container');
            if (container) {
                container.style.border = '2px solid #6232FF';
                container.style.boxShadow = 'none';
                container.style.borderRadius = '8px';
            }
            
            // Apply styles to rows
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                row.style.borderBottom = '1px solid #6232FF';
            });
            
            // Apply styles to header
            const header = table.querySelector('thead');
            if (header) {
                header.style.backgroundColor = '#6232FF';
                header.style.color = 'white';
                header.style.borderBottom = '1px solid #6232FF';
            }
        });
    },

    // Handle mobile column selection change
    handleMobileColumnChange(columnName) {
        console.log('Mobile column changed to:', columnName);
        this.mobileSelectedColumn = columnName;
        
        // Remove mobile-visible class from all columns
        const allColumns = document.querySelectorAll('.results-table th:not(:first-child), .results-table td:not(:first-child)');
        allColumns.forEach(col => {
            col.classList.remove('mobile-visible');
        });
        
        // Add mobile-visible class to the selected column
        const selectedHeaderIndex = this.getColumnIndex(columnName);
        if (selectedHeaderIndex > 0) { // Skip first column (always visible)
            const headers = document.querySelectorAll('.results-table th');
            const selectedHeader = headers[selectedHeaderIndex];
            if (selectedHeader) {
                selectedHeader.classList.add('mobile-visible');
                
                // Also add the class to all cells in that column
                const rows = document.querySelectorAll('.results-table tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > selectedHeaderIndex) {
                        cells[selectedHeaderIndex].classList.add('mobile-visible');
                    }
                });
            }
        }
    },
    
    // Helper to get column index by name
    getColumnIndex(columnName) {
        const columnMap = {
            'disciplina': 1,
            'pais': 2,
            'cierre': 3,
            'pago': 4
        };
        return columnMap[columnName] || 0;
    },

    // Handle window resize for mobile adaptations
    handleWindowResize() {
        // Only apply mobile column visibility if we're on a mobile device
        if (window.innerWidth <= 767) {
            // If the previously selected column was 'accion', default to 'disciplina'
            if (this.mobileSelectedColumn === 'accion') {
                this.mobileSelectedColumn = 'disciplina';
            }
            
            setTimeout(() => {
                this.handleMobileColumnChange(this.mobileSelectedColumn);
            }, 100);
        }
    },

    formatTitleWithCategory(title) {
        if (!title) return '';
        
        // Define all possible separator characters
        const separators = [
            '︱', // PRESENTATION FORM FOR VERTICAL EM DASH
            '⎮', // INTEGRAL EXTENSION
            '|',  // VERTICAL LINE
            '｜', // FULLWIDTH VERTICAL LINE
            '│', // BOX DRAWINGS LIGHT VERTICAL
            '┃', // BOX DRAWINGS HEAVY VERTICAL
            '┊', // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
            '┋'  // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
        ];
        
        // Find the first separator that exists in the string
        let separatorIndex = -1;
        let foundSeparator = null;
        
        for (const separator of separators) {
            const index = title.indexOf(separator);
            if (index !== -1) {
                separatorIndex = index;
                foundSeparator = separator;
                break;
            }
        }
        
        // If we found a separator, split the string and format
        if (foundSeparator && separatorIndex > 0) {
            const category = Utils.escapeHTML(title.substring(0, separatorIndex).trim());
            const name = Utils.escapeHTML(title.substring(separatorIndex + 1).trim());
            
            // Always use the presentation form for vertical bar "︱" instead of any other separator
            // This ensures consistent spacing regardless of which separator was in the original text
            const standardizedSeparator = '︱';
            
            // Use CSS classes for consistent spacing
            return `<span class="title-category" data-category="${category}">${category}</span><span class="separator-dash">${standardizedSeparator}</span><span class="separator-space">&nbsp;</span>${name}`;
        }
        
        // If no separator found, return the original title
        return Utils.escapeHTML(title);
    },
};