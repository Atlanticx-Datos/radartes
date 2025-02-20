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

// Expose modules to window object using a more reliable approach
function exposeModules() {
    window.SearchModule = SearchModule;
    console.log('SearchModule exposed to window:', {
        moduleExists: !!window.SearchModule,
        updateResultsExists: !!(window.SearchModule && window.SearchModule.updateResults)
    });
}

// Call expose immediately
exposeModules();

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    exposeModules();  // Ensure modules are exposed
    
    // Initialize core modules
    FilterModule.init();
    SearchModule.init();
    
    // Initialize DestacarModule if featured content exists
    if (window.processedDestacarData) {
        DestacarModule.init(window.processedDestacarData);
    }

    // Setup user menu functionality
    setupUserMenu();
    
    // Setup filter dropdown trigger
    setupFilterDropdown();
    
    // Setup preview button listeners
    setupPreviewButtons();
    
    // Ensure the clear button stays visible
    SearchModule.ensureClearButtonVisible();

    // Attach discipline filter handlers
    document.querySelectorAll('[data-discipline-filter]').forEach(button => {
        button.removeEventListener('click', () => FilterModule.handleDisciplineFilter(button));
        button.addEventListener('click', (e) => {
            e.preventDefault();
            FilterModule.handleDisciplineFilter(button);
        });
    });
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
            filterDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterDropdown.contains(e.target) && !filterTrigger.contains(e.target)) {
                filterDropdown.classList.add('hidden');
            }
        });
    }
}

// Setup preview button listeners
function setupPreviewButtons() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.preview-btn')) {
            const button = e.target.closest('.preview-btn');
            ModalModule.showPreviewModal(
                button.dataset.url,
                button.dataset.name,
                button.dataset.pais,
                button.dataset.og_resumida,
                button.dataset.id,
                button.dataset.categoria
            );
        }
    });
}

// Attach necessary functions to window object for backward compatibility
window.showPreviewModal = ModalModule.showPreviewModal.bind(ModalModule);
window.clearSearch = SearchModule.clearSearch.bind(SearchModule);
window.performSearch = SearchModule.performSearch.bind(SearchModule);
window.showAlert = Utils.showAlert.bind(Utils);
window.clearAllFilters = FilterModule.clearAllFilters.bind(FilterModule);
window.toggleDisciplineFilter = FilterModule.handleDisciplineFilter.bind(FilterModule);