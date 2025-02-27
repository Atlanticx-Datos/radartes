/**
 * site.js – Central JavaScript bundle.
 *
 * This file consolidates all module initialization and global event handling.
 * It serves as the main entry point for the application's JavaScript.
 */

import { FilterModule } from './modules/filters.js';
import { SearchModule } from './modules/search.js';
import { ModalModule } from './modules/modal.js';
import { DestacarModule } from './modules/destacar.js';
import { Utils } from './utils.js';
import { TopModule } from './modules/top.js';
import { SubscribeModule } from './modules/subscribe.js';
import { SharingModule } from './modules/sharing.js';
import { SharingTestModule } from './modules/sharing-test.js';

// Expose modules to window object using a more reliable approach
function exposeModules() {
    // Make modules available globally
    window.SearchModule = SearchModule;
    window.FilterModule = FilterModule;
    window.ModalModule = ModalModule;
    window.DestacarModule = DestacarModule;
    window.TopModule = TopModule;
    window.SharingModule = SharingModule;
    
    // Add global functions for destacar navigation
    window.nextDestacarPage = function() {
        if (window.DestacarModule) {
            window.DestacarModule.nextPage();
        } else {
            console.error('DestacarModule not available');
        }
    };
    
    window.prevDestacarPage = function() {
        if (window.DestacarModule) {
            window.DestacarModule.prevPage();
        } else {
            console.error('DestacarModule not available');
        }
    };
    
    // Initialize modules
    SearchModule.init();
    FilterModule.init();
    
    // Initialize sharing module
    SharingModule.init({
        brandInfo: {
            name: document.querySelector('meta[name="app-name"]')?.content || "100 ︱ Oportunidades",
            tagline: document.querySelector('meta[name="description"]')?.content || "Convocatorias, Becas y Recursos Globales para Artistas",
            url: window.location.origin,
            imageUrl: `${window.location.origin}/static/public/Logo_100_mediano.png`
        }
    });
    
    // Initialize sharing test module in development environments
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.search.includes('test=true')) {
        SharingTestModule.init();
    }
    
    // Expose pagination functions
    window.goToPage = SearchModule.goToPage.bind(SearchModule);
    console.log('Modules exposed to window:', {
        searchModuleExists: !!window.SearchModule,
        modalModuleExists: !!window.ModalModule,
        updateResultsExists: !!(window.SearchModule && window.SearchModule.updateResults),
        paginationExists: !!(window.SearchModule && window.SearchModule.goToPage)
    });
}

// Call expose immediately
exposeModules();

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Safely initialize HTMX configuration
    if (typeof htmx !== 'undefined') {
        htmx.config = htmx.config || {};
        htmx.config.headers = htmx.config.headers || {};
        htmx.config.headers['X-CSRFToken'] = document.querySelector('input[name="csrf_token"]')?.value || '';
    }
    
    // Process dynamic content
    htmx.process(document.body);
    
    exposeModules();  // Ensure modules are exposed
    
    // Initialize core modules
    FilterModule.init();
    SearchModule.init();
    
    // Get prefiltered data for module initialization
    const preFilteredData = document.getElementById('prefiltered-data');
    console.log('Checking prefiltered-data element:', preFilteredData);
    
    // Initialize modules with data from prefiltered-data
    if (preFilteredData) {
        console.log('prefiltered-data element found:', preFilteredData);
        console.log('prefiltered-data attributes:', 
            'has pages:', !!preFilteredData.dataset.pages,
            'has results:', !!preFilteredData.dataset.results);
        console.log('pages data length:', preFilteredData.dataset.pages ? preFilteredData.dataset.pages.length : 0);
        console.log('results data length:', preFilteredData.dataset.results ? preFilteredData.dataset.results.length : 0);
        
        // Parse pages data for TopModule and DestacarModule
        if (preFilteredData.dataset.pages) {
            try {
                const tempParser = new DOMParser();
                const pagesString = tempParser.parseFromString(preFilteredData.dataset.pages || '[]', 'text/html').body.textContent;
                console.log('Unescaped pages string length:', pagesString.length);
                
                const pages = JSON.parse(pagesString);
                console.log('Successfully parsed pages data, count:', pages.length);
                console.log('First page sample:', pages.length > 0 ? JSON.stringify(pages[0]).substring(0, 200) + '...' : 'No pages available');
                
                // Find pages with top=true for TopModule (accept both boolean true and string "true")
                const topPages = pages.filter(page => page.top === true || page.top === "true");
                console.log('Found', topPages.length, 'top pages for TopModule');
                
                // Log more details about the top pages
                if (topPages.length > 0) {
                    console.log('Top pages details:', topPages.map(p => ({
                        nombre: p.nombre_original,
                        top: p.top,
                        id: p.id
                    })));
                }
                
                // Check if any pages have top as a string "true" instead of boolean true
                const topPagesString = pages.filter(page => page.top === "true");
                if (topPagesString.length > 0) {
                    console.log('Found pages with top="true" (string):', topPagesString.length);
                    console.log('String top pages details:', topPagesString.map(p => ({
                        nombre: p.nombre_original,
                        top: p.top,
                        id: p.id
                    })));
                }
                
                // Log more details about the pages
                console.log('Sample of all pages:', pages.slice(0, 3).map(p => ({
                    nombre: p.nombre_original,
                    top: p.top,
                    hasTopProperty: 'top' in p
                })));
                
                // Check if any pages have the top property
                const pagesWithTopProperty = pages.filter(page => 'top' in page);
                console.log('Pages with top property:', pagesWithTopProperty.length);
                
                // If no top pages found, create a mock top page from the first destacar page
                let topPagesToUse = topPages;
                if (topPages.length === 0 && pages.length > 0) {
                    console.log('No top pages found, creating mock top page from first destacar page');
                    // Try to find a destacar page first
                    const destacarPages = pages.filter(page => page.destinatarios === 'Destacar');
                    if (destacarPages.length > 0) {
                        // Create a copy of the first destacar page and set top to true
                        const mockTopPage = {...destacarPages[0], top: true};
                        topPagesToUse = [mockTopPage];
                        console.log('Created mock top page from destacar page:', mockTopPage.nombre_original);
                    } else {
                        // If no destacar pages, use the first page
                        const mockTopPage = {...pages[0], top: true};
                        topPagesToUse = [mockTopPage];
                        console.log('Created mock top page from first page:', mockTopPage.nombre_original);
                    }
                }
                
                // Initialize TopModule with the top pages (real or mock)
                if (window.TopModule && typeof window.TopModule.init === 'function') {
                    if (topPagesToUse.length > 0) {
                        console.log('Initializing TopModule with', topPagesToUse.length, 'pages');
                        window.TopModule.init(topPagesToUse);
                    } else {
                        console.warn('No top pages available for TopModule');
                    }
                } else {
                    console.warn('TopModule not available');
                }
                
                // IMPORTANT: Always update SearchModule with ALL pages for initial load
                if (window.SearchModule && typeof window.SearchModule.updateResults === 'function') {
                    console.log('Initializing SearchModule with ALL pages:', pages.length);
                    window.SearchModule.updateResults(pages);
                } else {
                    console.warn('SearchModule not available for initialization');
                }
                
                // Check if DestacarModule needs initialization
                if (!window.processedDestacarData || !Array.isArray(window.processedDestacarData) || window.processedDestacarData.length === 0) {
                    // Filter pages with destinatarios === 'Destacar'
                    const destacarPages = pages.filter(page => page.destinatarios === 'Destacar');
                    if (destacarPages.length > 0) {
                        console.log('Found', destacarPages.length, 'destacar pages in prefiltered-data');
                        window.processedDestacarData = destacarPages;
                        
                        if (window.DestacarModule && typeof window.DestacarModule.init === 'function') {
                            console.log('Initializing DestacarModule with', destacarPages.length, 'items from prefiltered-data');
                            window.DestacarModule.init(destacarPages);
                        } else {
                            console.warn('DestacarModule not available for initialization');
                        }
                    } else {
                        console.warn('No destacar pages found in prefiltered-data');
                    }
                } else {
                    console.log('DestacarModule already has processedDestacarData:', window.processedDestacarData.length, 'items');
                    
                    if (window.DestacarModule && typeof window.DestacarModule.init === 'function') {
                        console.log('Initializing DestacarModule with existing processedDestacarData');
                        window.DestacarModule.init(window.processedDestacarData);
                    }
                }
            } catch (error) {
                console.error('Error parsing pages data:', error);
            }
        } else {
            console.warn('No pages data available in prefiltered-data');
        }
    } else {
        console.warn('prefiltered-data element not found');
    }
    
    // Setup user menu functionality
    setupUserMenu();
    
    // Setup filter dropdown trigger
    setupFilterDropdown();
    
    // Ensure the clear button stays visible
    SearchModule.ensureClearButtonVisible();

    // Remove the direct event listeners for discipline filter buttons
    // since we're now using the onclick attribute in HTML with toggleDisciplineFilter
    // document.querySelectorAll('[data-discipline-filter]').forEach(button => {
    //     button.removeEventListener('click', () => FilterModule.handleDisciplineFilter(button));
    //     button.addEventListener('click', (e) => {
    //         e.preventDefault();
    //         FilterModule.handleDisciplineFilter(button);
    //     });
    // });

    /* 
    // This section is now handled in the DOMContentLoaded event handler above
    // Initialize TopModule if we have pages data
    const preFilteredData = document.getElementById('prefiltered-data');
    if (preFilteredData) {
        console.log('Found prefiltered-data element:', preFilteredData);
        console.log('Data attributes:', {
            results: preFilteredData.dataset.results ? 'exists' : 'missing',
            pages: preFilteredData.dataset.pages ? 'exists' : 'missing'
        });
        
        try {
            // Use DOMParser to unescape HTML entities in the JSON string
            const tempParser = new DOMParser();
            const pagesString = tempParser.parseFromString(preFilteredData.dataset.pages || '[]', 'text/html').body.textContent;
            console.log('Unescaped pages string length:', pagesString.length);
            
            const pages = JSON.parse(pagesString);
            console.log('Parsed pages count:', pages.length);
            console.log('First page sample:', pages.length > 0 ? pages[0] : 'No pages available');
            
            if (pages.length > 0) {
                // Initialize TopModule with all pages
                TopModule.init(pages);
                console.log('TopModule initialized with', pages.length, 'pages');
                
                // Also initialize SearchModule with initial results if not already done
                if (window.SearchModule && typeof window.SearchModule.updateResults === 'function') {
                    window.SearchModule.updateResults(pages);
                    console.log('SearchModule initialized with initial results');
                }
            } else {
                console.warn('No pages data available for TopModule initialization');
            }
        } catch (error) {
            console.error('Error parsing pages data for TopModule:', error);
        }
    }
    */
    
    // Add navigation functions to window
    window.nextTopPage = TopModule.nextPage.bind(TopModule);
    window.prevTopPage = TopModule.prevPage.bind(TopModule);

    // Initialize SubscribeModule
    SubscribeModule.init();

    // Populate filter dropdowns
    populateSubdisciplinasDropdown();
    populateCountryDropdown();
    populateMonthDropdown();
});

// Setup user menu functionality
function setupUserMenu() {
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenu = document.getElementById('user-menu');

    if (userMenuButton && userMenu) {
        userMenuButton.addEventListener('click', function() {
            userMenu.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!userMenuButton.contains(event.target) && !userMenu.contains(event.target)) {
                userMenu.classList.add('hidden');
            }
        });
    }
}

// Setup filter dropdown functionality
function setupFilterDropdown() {
    const filterTrigger = document.getElementById('filter-dropdown-trigger');
    const filterDropdown = document.getElementById('structured-filters');

    if (filterTrigger && filterDropdown) {
        filterTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (filterDropdown.classList.contains('hidden')) {
                // Show dropdown: remove hidden and reposition it fixed relative to the trigger
                filterDropdown.classList.remove('hidden');
                const triggerRect = filterTrigger.getBoundingClientRect();
                filterDropdown.style.position = 'fixed';
                filterDropdown.style.top = (triggerRect.bottom + 5) + 'px';
                filterDropdown.style.left = triggerRect.left + 'px';
                
                // Reparent the dropdown to document.body, if not already there
                if (filterDropdown.parentElement !== document.body) {
                    document.body.appendChild(filterDropdown);
                }
            } else {
                filterDropdown.classList.add('hidden');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterDropdown.contains(e.target) && !filterTrigger.contains(e.target)) {
                filterDropdown.classList.add('hidden');
            }
        });
        
        // Set up collapsible filter sections
        document.querySelectorAll('.filter-dropdown-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const targetId = trigger.dataset.target;
                const content = document.getElementById(targetId);
                const chevron = trigger.querySelector('svg');
                
                // Close all other dropdowns and reset their chevrons
                document.querySelectorAll('.filter-dropdown-content').forEach(dropdown => {
                    if (dropdown.id !== targetId) {
                        dropdown.classList.add('hidden');
                        // Reset other chevrons to point down
                        const otherTrigger = document.querySelector(`[data-target="${dropdown.id}"]`);
                        if (otherTrigger) {
                            const otherChevron = otherTrigger.querySelector('svg');
                            if (otherChevron) {
                                otherChevron.classList.remove('rotate-180');
                            }
                        }
                    }
                });
                
                // Toggle this dropdown
                content.classList.toggle('hidden');
                
                // Toggle chevron direction
                if (chevron) {
                    chevron.classList.toggle('rotate-180');
                }
            });
        });
        
        // Setup category checkboxes
        document.querySelectorAll('input[name="categories"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                updateSelectedValues('categories-dropdown', 'categories');
            });
        });
        
        // Setup country radio buttons
        const countryContainer = document.getElementById('country-container');
        if (countryContainer) {
            // We'll populate this dynamically, but set up the event delegation
            countryContainer.addEventListener('change', (e) => {
                if (e.target.name === 'country') {
                    updateSelectedValues('country-dropdown', 'country');
                }
            });
        }
        
        // Setup month radio buttons
        const monthContainer = document.getElementById('month-container');
        if (monthContainer) {
            // We'll populate this dynamically, but set up the event delegation
            monthContainer.addEventListener('change', (e) => {
                if (e.target.name === 'month') {
                    updateSelectedValues('month-dropdown', 'month');
                }
            });
        }
        
        // Setup inscripcion checkbox
        const inscripcionCheckbox = document.getElementById('inscripcion-checkbox');
        if (inscripcionCheckbox) {
            inscripcionCheckbox.addEventListener('change', () => {
                updateSelectedValues('inscripcion-dropdown', 'inscripcion');
            });
        }
        
        // Set up search button
        const searchButton = document.getElementById('search-filters');
        if (searchButton) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                SearchModule.handleStructuredSearch();
            });
        }
        
        // Setup clear filters button
        const clearFiltersButton = document.getElementById('clear-filters');
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Call clearAllFilters but make sure the event doesn't bubble up
                clearAllFilters();
                
                // Explicitly prevent the dropdown from closing
                return false;
            });
        }
    }
}

// Function to update the selected values display in the dropdown trigger
function updateSelectedValues(dropdownId, filterType) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.querySelector(`[data-target="${dropdownId}"]`);
    const selectedValuesSpan = trigger.querySelector('.selected-values');
    
    if (!dropdown || !trigger || !selectedValuesSpan) return;
    
    let selectedText = '';
    
    if (filterType === 'categories') {
        const selectedCheckboxes = dropdown.querySelectorAll('input[name="categories"]:checked');
        const values = Array.from(selectedCheckboxes).map(cb => cb.nextElementSibling.textContent.trim());
        
        if (values.length > 0) {
            selectedText = values.join(', ');
            // Update SearchModule's active filters
            SearchModule.activeFilters.categories = new Set(
                Array.from(selectedCheckboxes).map(cb => cb.value)
            );
        } else {
            SearchModule.activeFilters.categories.clear();
        }
    } 
    else if (filterType === 'subdisciplinas') {
        const selectedCheckboxes = dropdown.querySelectorAll('input[name="subdisciplinas"]:checked');
        const values = Array.from(selectedCheckboxes).map(cb => cb.nextElementSibling.textContent.trim());
        
        if (values.length > 0) {
            selectedText = values.join(', ');
            // Update SearchModule's active filters
            SearchModule.activeFilters.subdisciplinas = new Set(
                Array.from(selectedCheckboxes).map(cb => cb.value)
            );
        } else {
            SearchModule.activeFilters.subdisciplinas.clear();
        }
    }
    else if (filterType === 'country') {
        // Handle country as checkboxes for multiple selection
        const selectedCheckboxes = dropdown.querySelectorAll('input[type="checkbox"][name="country"]:checked');
        const values = Array.from(selectedCheckboxes).map(cb => cb.nextElementSibling.textContent.trim());
        
        if (values.length > 0) {
            selectedText = values.join(', ');
            // Update SearchModule's active filters with an array of countries
            SearchModule.activeFilters.country = Array.from(selectedCheckboxes).map(cb => cb.value);
        } else {
            // No countries selected means no filtering by country
            selectedText = '';
            SearchModule.activeFilters.country = [];
        }
    }
    else if (filterType === 'month') {
        // Handle month as checkboxes for multiple selection
        const selectedCheckboxes = dropdown.querySelectorAll('input[name="month"]:checked');
        const values = Array.from(selectedCheckboxes).map(cb => cb.nextElementSibling.textContent.trim());
        
        if (values.length > 0) {
            selectedText = values.join(', ');
            // Update SearchModule's active filters with an array of months
            SearchModule.activeFilters.month = values;
        } else {
            // No months selected means no filtering by month
            selectedText = '';
            SearchModule.activeFilters.month = [];
        }
    }
    else if (filterType === 'inscripcion') {
        const checkbox = document.getElementById('inscripcion-checkbox');
        if (checkbox && checkbox.checked) {
            selectedText = 'Sin pago';
            // Update SearchModule's active filters
            SearchModule.activeFilters.freeOnly = true;
        } else {
            SearchModule.activeFilters.freeOnly = false;
        }
    }
    
    selectedValuesSpan.textContent = selectedText;
    
    console.log('Updated SearchModule.activeFilters:', {
        categories: Array.from(SearchModule.activeFilters.categories),
        subdisciplinas: Array.from(SearchModule.activeFilters.subdisciplinas),
        country: SearchModule.activeFilters.country,
        month: SearchModule.activeFilters.month,
        freeOnly: SearchModule.activeFilters.freeOnly
    });
}

// Function to populate the subdisciplinas dropdown
function populateSubdisciplinasDropdown() {
    const pages = JSON.parse(document.getElementById('prefiltered-data')?.dataset.pages || '[]');
    const subdisciplinasSet = new Set();
    const container = document.getElementById('subdisciplinas-container');
    
    if (!container) return;
    
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
    
    // Clear existing content
    container.innerHTML = '';
    
    // Add checkboxes for each subdisciplina
    [...subdisciplinasSet].sort().forEach(sub => {
        const label = document.createElement('label');
        label.className = 'flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-checkbox h-4 w-4 text-blue-600';
        input.value = sub;
        input.name = 'subdisciplinas';
        
        input.addEventListener('change', () => {
            updateSelectedValues('subdisciplinas-dropdown', 'subdisciplinas');
        });
        
        const span = document.createElement('span');
        span.className = 'ml-2 text-gray-700';
        span.textContent = sub;
        
        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(label);
    });
}

// Function to populate the country dropdown
function populateCountryDropdown() {
    try {
        const prefilteredData = document.getElementById('prefiltered-data');
        if (!prefilteredData || !prefilteredData.dataset.pages) {
            console.error('No prefiltered data found for country dropdown');
            return;
        }
        
        // Parse the data and extract unique countries
        const pages = JSON.parse(prefilteredData.dataset.pages);
        
        // Debug the first few pages to see what fields are available
        console.log('First 3 pages for debugging:', pages.slice(0, 3));
        
        // Try both 'pais' and 'país' fields
        const countries = [...new Set(
            pages.map(page => page.país || page.pais)
                .filter(Boolean)
        )].sort();
        
        console.log(`Found ${countries.length} unique countries:`, countries);
        
        const container = document.getElementById('country-container');
        if (!container) {
            console.error('Country container not found');
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Add checkboxes for each country (no "Todos los países" option)
        countries.forEach(country => {
            if (!country) return; // Skip empty values
            
            const label = document.createElement('label');
            label.className = 'flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer';
            
            const input = document.createElement('input');
            input.type = 'checkbox'; // Checkbox for multiple selection
            input.className = 'form-checkbox h-4 w-4 text-blue-600';
            input.value = country;
            input.name = 'country';
            
            const span = document.createElement('span');
            span.className = 'ml-2 text-gray-700';
            span.textContent = country;
            
            label.appendChild(input);
            label.appendChild(span);
            container.appendChild(label);
        });
        
        // Add change event listener for country checkboxes
        container.querySelectorAll('input[name="country"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                updateSelectedValues('country-dropdown', 'country');
            });
        });
        
        console.log('Country dropdown populated successfully');
    } catch (error) {
        console.error('Error populating country dropdown:', error);
    }
}

// Function to populate the month dropdown
function populateMonthDropdown() {
    const container = document.getElementById('month-container');
    
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    const months = [
        { value: 'Enero', label: 'Enero' },
        { value: 'Febrero', label: 'Febrero' },
        { value: 'Marzo', label: 'Marzo' },
        { value: 'Abril', label: 'Abril' },
        { value: 'Mayo', label: 'Mayo' },
        { value: 'Junio', label: 'Junio' },
        { value: 'Julio', label: 'Julio' },
        { value: 'Agosto', label: 'Agosto' },
        { value: 'Septiembre', label: 'Septiembre' },
        { value: 'Octubre', label: 'Octubre' },
        { value: 'Noviembre', label: 'Noviembre' },
        { value: 'Diciembre', label: 'Diciembre' }
    ];
    
    // Add checkboxes for each month (no "Todos los meses" option)
    months.forEach(month => {
        const label = document.createElement('label');
        label.className = 'flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer';
        
        const input = document.createElement('input');
        input.type = 'checkbox'; // Checkbox for multiple selection
        input.className = 'form-checkbox h-4 w-4 text-blue-600';
        input.value = month.value;
        input.name = 'month';
        
        const span = document.createElement('span');
        span.className = 'ml-2 text-gray-700';
        span.textContent = month.label;
        
        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(label);
    });
    
    // Add change event listener for month checkboxes
    container.querySelectorAll('input[name="month"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateSelectedValues('month-dropdown', 'month');
        });
    });
    
    console.log('Month dropdown populated successfully');
}

// Function to update selected values for subdisciplinas
function updateSubdisciplinasSelectedValues() {
    const dropdown = document.getElementById('subdisciplinas-dropdown');
    const trigger = document.querySelector('[data-target="subdisciplinas-dropdown"]');
    const selectedValuesSpan = trigger.querySelector('.selected-values');
    
    if (!dropdown || !trigger || !selectedValuesSpan) return;
    
    const selectedCheckboxes = dropdown.querySelectorAll('input[name="subdisciplinas"]:checked');
    const values = Array.from(selectedCheckboxes).map(cb => cb.nextElementSibling.textContent.trim());
    
    if (values.length > 0) {
        selectedValuesSpan.textContent = values.join(', ');
        // Update SearchModule's active filters
        SearchModule.activeFilters.subdisciplinas = new Set(
            Array.from(selectedCheckboxes).map(cb => cb.value)
        );
    } else {
        selectedValuesSpan.textContent = '';
        SearchModule.activeFilters.subdisciplinas = new Set();
    }
}

// Toggle dropdown function for share buttons
function toggleDropdown(button) {
    const dropdown = button.nextElementSibling;
    
    // Close all other open dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(content => {
        if (content !== dropdown && !content.classList.contains('hidden')) {
            content.classList.add('hidden');
        }
    });
    
    // Toggle the clicked dropdown
    dropdown.classList.toggle('hidden');
    
    // Add click outside listener to close dropdown
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    };
    
    // Only add the listener if we're opening the dropdown
    if (!dropdown.classList.contains('hidden')) {
        // Use setTimeout to avoid immediate trigger of the event
        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
        }, 0);
    }
}

// Enhanced share opportunity function that uses the new SharingModule
function shareOpportunity(url, title, platform, extraData = {}) {
    // Use base_url if provided, otherwise use the regular url
    const shareUrl = extraData.base_url || url;
    
    // Create opportunity object with available data
    const opportunity = {
        id: extraData.id || 'unknown',
        nombre: title,
        url: shareUrl,
        país: extraData.country || '',
        disciplina: extraData.disciplina || '',
        fecha_de_cierre: extraData.fecha_de_cierre || '',
        inscripcion: extraData.inscripcion || ''
    };
    
    // Use the SharingModule to handle sharing
    return SharingModule.shareOpportunity(opportunity, platform);
}

// Attach necessary functions to window object for backward compatibility
window.showPreviewModal = ModalModule.showPreviewModal.bind(ModalModule);
window.clearSearch = SearchModule.clearSearch.bind(SearchModule);
window.performSearch = SearchModule.performSearch.bind(SearchModule);
window.showAlert = Utils.showAlert.bind(Utils);
window.clearAllFilters = FilterModule.clearAllFilters.bind(FilterModule);
window.toggleDisciplineFilter = function(button, discipline) {
    // Ensure the button has the correct discipline value in its dataset
    button.dataset.disciplineFilter = discipline;
    
    // Update the active state visually
    const allButtons = document.querySelectorAll('[data-discipline-filter]');
    allButtons.forEach(btn => {
        if (btn !== button) {
            btn.dataset.active = 'false';
            btn.classList.remove('active-filter');
        }
    });
    
    // Toggle the active state of the clicked button
    const isActive = button.dataset.active === 'true';
    button.dataset.active = isActive ? 'false' : 'true';
    
    if (button.dataset.active === 'true') {
        button.classList.add('active-filter');
    } else {
        button.classList.remove('active-filter');
    }
    
    // Call the FilterModule's handleDisciplineFilter method
    FilterModule.handleDisciplineFilter(button);
    
    // Explicitly hide/show destacados container based on active discipline
    const destacadosContainer = document.querySelector('.destacados-container');
    const prevControl = document.querySelector('.destacar-prev');
    const nextControl = document.querySelector('.destacar-next');
    
    if (button.dataset.active === 'true' && discipline !== 'todos') {
        destacadosContainer?.classList.add('hidden');
        prevControl?.classList.add('hidden');
        nextControl?.classList.add('hidden');
    } else if (discipline === 'todos' || button.dataset.active === 'false') {
        destacadosContainer?.classList.remove('hidden');
        prevControl?.classList.remove('hidden');
        nextControl?.classList.remove('hidden');
    }
};
window.goToPage = SearchModule.goToPage.bind(SearchModule);
window.toggleDropdown = toggleDropdown;
window.shareOpportunity = shareOpportunity;

// Add CSRF token configuration
document.body.addEventListener('htmx:configRequest', function(evt) {
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
    if (csrfToken) {
        evt.detail.headers['X-CSRFToken'] = csrfToken;
    }
});

document.body.addEventListener('htmx:beforeRequest', function(evt) {
    htmx.config.withCredentials = true;
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.classList.remove('hidden');
    }
});

document.body.addEventListener('htmx:afterRequest', function(evt) {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }

    const notification = document.getElementById('notification');
    if (!notification) return;

    if (evt.detail.successful) {
        // Check if it's a delete request
        const isDelete = evt.detail.pathInfo.requestPath.includes('/delete_opportunity/');
        const message = isDelete 
            ? 'Ok! Borramos tu oportunidad'
            : 'Bien! Ya guardaste la oportunidad en tu espacio personal';

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 4px;
            background: #d1fae5;
            color: #065f46;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 9999;
        `;

        notification.innerHTML = `
            <svg style="flex-shrink:0; width:20px; height:20px;" viewBox="0 0 24 24" fill="none">
                <path stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span style="font-size:14px; font-weight:500;">${message}</span>
        `;
        notification.classList.remove('hidden');
    } else {
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 4px;
            background: #fee2e2;
            color: #991b1b;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 9999;
        `;

        notification.innerHTML = `
            <svg style="flex-shrink:0; width:20px; height:20px;" viewBox="0 0 24 24" fill="none">
                <path stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span style="font-size:14px; font-weight:500;">Error en la operación</span>
        `;
        notification.classList.remove('hidden');
    }
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 150ms ease-out';
        setTimeout(() => {
            notification.classList.add('hidden');
            notification.innerHTML = '';
            notification.style = ''; // Reset styles
        }, 150);
    }, 3000);
});

document.body.addEventListener('htmx:afterResponse', function(evt) {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
});

document.body.addEventListener('htmx:responseError', function(evt) {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
    
    if (evt.detail.xhr.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.href);
    }
});

document.body.addEventListener('htmx:afterProcessNode', function(evt) {
    try {
        htmx.process(evt.target);
    } catch (e) {
        console.error('HTMX processing error:', e);
    }
});

// Global modal click handler
const handleModalClick = (e) => {
    const previewButton = e.target.closest('.preview-btn');
    if (!previewButton) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Prevent multiple modals from being opened
    const existingModal = document.querySelector('[id^="modal-"]');
    if (existingModal) return;

    if (window.ModalModule?.showPreviewModal) {
        const dataset = previewButton.dataset;
        ModalModule.showPreviewModal(
            dataset.url,
            dataset.nombre || dataset.name,
            dataset.pais || dataset.country,
            dataset.og_resumida || dataset.summary,
            dataset.id,
            dataset.categoria || dataset.category,
            dataset.baseUrl || dataset.base_url,
            dataset.requisitos
        );
    }
};

// Add the single event listener when the script loads
document.addEventListener('click', handleModalClick);

// Function to clear all filters
function clearAllFilters() {
    // Reset all filter inputs
    document.getElementById('open-search').value = '';
    
    // Reset all dropdown selections
    document.querySelectorAll('#structured-filters input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Reset radio buttons
    document.querySelectorAll('#structured-filters input[type="radio"]').forEach(radio => {
        if (radio.value === '') {
            radio.checked = true;
        } else {
            radio.checked = false;
        }
    });
    
    // Reset selected values display
    document.querySelectorAll('.selected-values').forEach(span => {
        span.textContent = '';
    });
    
    // Reset all chevrons to point down (not rotated)
    document.querySelectorAll('.filter-dropdown-trigger svg').forEach(chevron => {
        chevron.classList.remove('rotate-180');
    });
    
    // Reset SearchModule's active filters
    if (window.SearchModule) {
        SearchModule.activeFilters.categories.clear();
        SearchModule.activeFilters.subdisciplinas.clear();
        SearchModule.activeFilters.country = [];
        SearchModule.activeFilters.month = [];
        SearchModule.activeFilters.freeOnly = false;
        
        // Perform search with cleared filters but don't scroll
        SearchModule.handleStructuredSearch(false);
    }
    
    console.log('All filters cleared');
    
    // Explicitly prevent the dropdown from closing
    const event = window.event;
    if (event) {
        event.stopPropagation();
    }
    
    // Make sure all filter dropdowns are hidden (collapsed)
    document.querySelectorAll('.filter-dropdown-content').forEach(dropdown => {
        dropdown.classList.add('hidden');
    });
    
    // DO NOT hide the main structured filters dropdown
    // document.getElementById('structured-filters').classList.add('hidden');
}