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

// Expose modules to window object using a more reliable approach
function exposeModules() {
    window.SearchModule = SearchModule;
    window.ModalModule = ModalModule;  // Expose ModalModule
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
    
    // Initialize modal handlers globally
    setupModalHandlers();
    
    // Initialize DestacarModule if featured content exists
    if (window.processedDestacarData) {
        DestacarModule.init(window.processedDestacarData);
    }

    // Setup user menu functionality
    setupUserMenu();
    
    // Setup filter dropdown trigger
    setupFilterDropdown();
    
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

    // Initialize TopModule if we have pages data
    const preFilteredData = document.getElementById('prefiltered-data');
    if (preFilteredData) {
        const pages = JSON.parse(preFilteredData.dataset.pages);
        TopModule.init(pages);
    }
    
    // Add navigation functions to window
    window.nextTopPage = TopModule.nextPage.bind(TopModule);
    window.prevTopPage = TopModule.prevPage.bind(TopModule);

    // Initialize SubscribeModule
    SubscribeModule.init();
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

// Attach necessary functions to window object for backward compatibility
window.showPreviewModal = ModalModule.showPreviewModal.bind(ModalModule);
window.clearSearch = SearchModule.clearSearch.bind(SearchModule);
window.performSearch = SearchModule.performSearch.bind(SearchModule);
window.showAlert = Utils.showAlert.bind(Utils);
window.clearAllFilters = FilterModule.clearAllFilters.bind(FilterModule);
window.toggleDisciplineFilter = FilterModule.handleDisciplineFilter.bind(FilterModule);
window.goToPage = SearchModule.goToPage.bind(SearchModule);

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

// New global modal handler setup
function setupModalHandlers() {
    document.addEventListener('click', (e) => {
        const previewButton = e.target.closest('.preview-btn');
        if (!previewButton) return;
        
        e.preventDefault();
        e.stopPropagation();
        handlePreviewClick(previewButton.dataset);
    });
}

// Centralized preview click handler
function handlePreviewClick(dataset) {
    if (window.ModalModule?.showPreviewModal) {
        ModalModule.showPreviewModal(
            dataset.url,
            dataset.nombre || dataset.name,
            dataset.pais || dataset.country,
            dataset.og_resumida || dataset.summary,
            dataset.id,
            dataset.categoria || dataset.category
        );
    }
}