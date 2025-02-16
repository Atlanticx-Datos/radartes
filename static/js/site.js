/**
 * site.js – Central JavaScript bundle.
 *
 * This file consolidates your inline JavaScript from the various templates
 * (e.g., from database.html, _search_results.html, and layout.html) into a single,
 * modular file.
 *
 * All functions that are invoked via inline attributes (e.g. clearSearch, showPreviewModal,
 * layoutshowSpinner, toggleDropdown, shareOpportunity, and copyUrl) are attached
 * to the window object to maintain backwards compatibility.
 *
 * This refactoring does not change any functionality or ordering—it simply
 * exposes better documentation, clearer structure, and a separation of concerns.
 */
import { initSearchEnhancements } from './search.js';

// Add this near the top of the file with other constants
const month_mapping = {
    'enero': 1,
    'febrero': 2,
    'marzo': 3,
    'abril': 4,
    'mayo': 5,
    'junio': 6,
    'julio': 7,
    'agosto': 8,
    'septiembre': 9,
    'octubre': 10,
    'noviembre': 11,
    'diciembre': 12
};

(function() {
  "use strict";
  
  // ============================================================================
  // Module: Search & HTMX Handling
  // ============================================================================

  var searchInProgress = false;
  var searchTimeout;

  /**
   * Toggles the display of the spinner element.
   * @param {boolean} show - Whether to show the spinner.
   */
  function toggleSpinner(show) {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Tracks a search event.
   * @param {string} searchTerm - Term being searched.
   */
  function trackSearch(searchTerm) {
    if (typeof gtag === "function") {
      gtag("event", "opportunity_search", {
        send_to: "G-36M4V4L5RX",
        search_term: searchTerm,
        search_type: "opportunity",
      });
    }
  }

  /**
   * Tracks a search error event.
   * @param {string} searchTerm - Search term.
   * @param {string} errorType - Error type.
   */
  function trackSearchError(searchTerm, errorType) {
    if (typeof gtag === "function") {
      gtag("event", "search_error", {
        search_term: searchTerm,
        error_type: errorType,
      });
    }
  }

  /**
   * Handles keypress events on the search input.
   * If Enter is pressed, it triggers a search.
   * @param {KeyboardEvent} event 
   */
  function handleKeyPress(event) {
    if (event.key === "Enter" && !searchInProgress) {
      event.preventDefault();
      var searchValue = document.getElementById("search-input").value.trim();
      if (searchValue.length >= 3) {
        searchInProgress = true;
        trackSearch(searchValue);
        htmx.ajax("GET", "/database?search=" + encodeURIComponent(searchValue), {
          target: "#search-results",
          swap: "innerHTML",
          headers: { "HX-Request": "true" },
          onAfterSwap: function () {
            searchInProgress = false;
          },
          onError: function (error) {
            console.error("Search error:", error);
            trackSearchError(searchValue, "fetch_error");
            searchInProgress = false;
          },
        });
      }
    }
  }

  // Expose clearSearch globally because it is called via inline HTML attributes.
  window.clearSearch = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    console.log("Explicit clear search action triggered");
    var searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.value = "";
        history.replaceState(null, null, window.location.pathname);
        htmx.ajax("GET", "/database?clear=true", {
            target: "#search-results",
            swap: "innerHTML",
            headers: { "HX-Request": "true" },
        });
    }
  };

  // ============================================================================
  // Module: Modal Handling
  // ============================================================================

  /**
   * Opens and displays the preview modal.
   *
   * @param {string} url - The URL to open.
   * @param {string} name - Opportunity name.
   * @param {string} country - Country info.
   * @param {string} summary - Opportunity short summary.
   * @param {string} id - Opportunity ID.
   */
  window.showPreviewModal = function(url, name, country, summary, id) {
    var modalId = "modal-" + Date.now();

    // Create an overlay element that covers the entire viewport and applies blur
    var overlay = document.createElement("div");
    overlay.id = modalId + "-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0, 0, 0, 0.3)";
    overlay.style.backdropFilter = "blur(4px)";
    overlay.style.WebkitBackdropFilter = "blur(4px)";
    overlay.style.zIndex = "50";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 300ms ease-out";

    // Create the modal content container
    var modalContent = document.createElement("div");
    modalContent.id = modalId;
    // Removed the earlier modal-animate class in favor of inline transition styles.
    modalContent.className = "bg-white rounded-lg w-full max-w-lg overflow-hidden border border-neutral";
    modalContent.style.position = "fixed";
    modalContent.style.top = "50%";
    modalContent.style.left = "50%";
    // Start slightly above the final position (for a gentle slide effect)
    modalContent.style.transform = "translate(-50%, -45%)";
    modalContent.style.zIndex = "51";
    modalContent.style.opacity = "0";
    modalContent.style.transition = "opacity 300ms ease-out, transform 300ms ease-out";

    modalContent.innerHTML = `
      <div class="flex items-center justify-between p-3 border-b border-neutral bg-gray-50">
          <h3 class="text-lg font-medium text-gray-900">Vista previa de la oportunidad</h3>
          <button class="text-neutral-700 hover:text-neutral-900 px-3 py-1 transition-colors" 
                  onclick="document.getElementById('${modalId}-overlay').remove(); document.getElementById('${modalId}').remove(); document.body.classList.remove('modal-open');">
              ✕
          </button>
      </div>
      <div class="p-6">
          <div class="space-y-4">
              <div>
                  <p class="text-sm text-gray-500">Nombre</p>
                  <p class="mt-1 text-sm text-gray-900">${name || "No disponible"}</p>
              </div>
              <div>
                  <p class="text-sm text-gray-500">País</p>
                  <p class="mt-1 text-sm text-gray-900">${country || "No disponible"}</p>
              </div>
              ${ summary ? `
              <div>
                  <p class="text-sm text-gray-500">Resumen</p>
                  <div class="mt-2 p-4 bg-gray-50 rounded-lg">
                      <p class="text-sm text-gray-700 whitespace-pre-line">${summary}</p>
                  </div>
              </div>` : "" }
              <div>
                  <p class="text-sm text-gray-500">URL</p>
                  <a href="${url}" class="mt-1 text-sm text-blue-600 hover:text-blue-800 break-all" target="_blank">
                      ${url}
                  </a>
              </div>
              <div class="mt-6 flex justify-end space-x-3">
                  <button onclick="document.getElementById('${modalId}-overlay').remove(); document.getElementById('${modalId}').remove(); document.body.classList.remove('modal-open');" 
                          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
                      Cerrar
                  </button>
                  <button hx-post="/save_from_modal"
                          hx-vals='{"page_id": "${encodeURIComponent(id)}"}'
                          hx-target="#notification"
                          hx-swap="innerHTML"
                          hx-trigger="click"
                          class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md">
                      Guardar
                  </button>
                  <a href="${url}" target="_blank" 
                     class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                      Ir al sitio web
                  </a>
              </div>
          </div>
      </div>`;

    // Append to the document
    document.body.appendChild(overlay);
    document.body.appendChild(modalContent);
    document.body.classList.add("modal-open");

    // Trigger animations after mounting (using requestAnimationFrame to ensure CSS changes take effect)
    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        modalContent.style.opacity = "1";
        modalContent.style.transform = "translate(-50%, -50%)";
    });

    // Animate close on clicking the overlay
    overlay.addEventListener("click", function() {
        overlay.style.opacity = "0";
        modalContent.style.opacity = "0";
        setTimeout(() => {
            overlay.remove();
            modalContent.remove();
            document.body.classList.remove("modal-open");
        }, 300);
    });

    // Animate close on pressing the Escape key
    function escListener(event) {
        if (event.key === "Escape") {
            overlay.style.opacity = "0";
            modalContent.style.opacity = "0";
            setTimeout(() => {
                overlay.remove();
                modalContent.remove();
                document.body.classList.remove("modal-open");
            }, 300);
            document.removeEventListener("keydown", escListener);
        }
    }
    document.addEventListener("keydown", escListener);

    // After adding modal to DOM, initialize HTMX
    setTimeout(() => htmx.process(modalContent), 50);
  };

  // ============================================================================
  // Module: Layout Spinner Handling
  // ============================================================================

  /**
   * Shows a spinner on layout navigation.
   * Invoked via inline onClick attributes.
   *
   * @param {Event} event - The click event.
   */
  window.layoutshowSpinner = function() {
    console.log('layoutshowSpinner called');
    const spinner = document.getElementById('layout-spinner');
    console.log('spinner element:', spinner);
    if (spinner) {
        spinner.style.display = 'block';
        console.log('spinner display set to block');
    } else {
        console.warn('spinner element not found');
    }
  };

  // Hide spinner function
  window.hideSpinner = function() {
    console.log('hideSpinner called');
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.style.display = 'none';
        console.log('spinner hidden');
    } else {
        console.warn('spinner element not found in hideSpinner');
    }
  };

  // ============================================================================
  // Module: Dropdown & Share Functionality
  // ============================================================================

  /**
   * Opens a sharing URL based on the selected platform.
   *
   * @param {string} url - URL to share.
   * @param {string} title - Opportunity title.
   * @param {string} platform - "whatsapp", "linkedin", or "gmail".
   */
  window.shareOpportunity = function(url, title, platform) {
    var encodedUrl = encodeURIComponent(url);
    var encodedTitle = encodeURIComponent("\n- + Oportunidades");
    var shareUrl = "";

    if (platform === "whatsapp") {
      shareUrl = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&text=${encodedTitle}`;
    } else if (platform === "gmail") {
      shareUrl = `mailto:?subject=${encodeURIComponent(encodedTitle)}&body=${encodedUrl}`;
    }
    window.open(shareUrl, "_blank");
  };

  /**
   * Copies the given URL to the clipboard.
   *
   * @param {string} url - The URL to copy.
   */
  window.copyUrl = function(url) {
    navigator.clipboard
      .writeText(url)
      .then(function() {
        var alert = document.createElement("div");
        alert.className = "alert";
        alert.textContent = "URL COPIADO";
        document.body.appendChild(alert);
        setTimeout(function() {
          alert.remove();
        }, 3000);
      })
      .catch(function(err) {
        console.error("Error copying URL:", err);
      });
  };

  /**
   * Toggles a dropdown menu.
   * Exposed globally because it is invoked via inline onClick attributes.
   *
   * @param {HTMLElement} button - The dropdown toggle button.
   */
  window.toggleDropdown = function(button) {
    event.preventDefault();
    event.stopPropagation();

    // Close all other dropdowns
    document.querySelectorAll("th .dropdown-content").forEach(function(d) {
      if (d !== button.nextElementSibling) {
        d.classList.add("hidden");
      }
    });

    // Toggle the current dropdown
    var dropdown = button.nextElementSibling;
    dropdown.classList.toggle("hidden");
    if (!dropdown.classList.contains("hidden")) {
      var buttonHeight = button.offsetHeight;
      dropdown.style.top = buttonHeight + 4 + "px";
      dropdown.style.right = "0";
      dropdown.style.zIndex = "9999";
    }
  };

  // ============================================================================
  // Module: Global Initialization & Event Listeners
  // ============================================================================

  document.addEventListener("DOMContentLoaded", function() {
    // Initialize search enhancements
    initSearchEnhancements();
    
    // --------------------------------------------------------------------------
    // Setup search input event listeners.
    // --------------------------------------------------------------------------
    var searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function(event) {
        if (searchInProgress) return;
        clearTimeout(searchTimeout);
        var searchTerm = event.target.value.trim();
        console.log("Search term:", searchTerm);

        if (searchTerm === "") {
          console.log("Clearing search results");
          htmx.ajax("GET", "/database?clear=true", {
            target: "#search-results",
            swap: "innerHTML",
            headers: { "HX-Request": "true" },
          });
          return;
        }

        if (searchTerm.length >= 3) {
          searchTimeout = setTimeout(function() {
            console.log("Performing search for:", searchTerm);
            htmx.ajax("GET", "/database?search=" + encodeURIComponent(searchTerm), {
              target: "#search-results",
              swap: "innerHTML",
              headers: { "HX-Request": "true" },
              onAfterSwap: function () {
                searchInProgress = false;
              }
            });
          }, 500);
        }
      });

      searchInput.addEventListener("keypress", handleKeyPress);
    }

    // --------------------------------------------------------------------------
    // Opportunity modal trigger for table, accordion, "destacadas", and "cierran pronto" links.
    // --------------------------------------------------------------------------
    document.body.addEventListener("click", function(event) {
      const modalLink = event.target.closest(".opportunity-link, .destacada-link, .cierran-pronto-link");
      if (modalLink) {
        event.preventDefault();
        event.stopPropagation();

        const targetUrl = modalLink.dataset.url;
        const name = modalLink.dataset.name;
        const country = modalLink.dataset.country;
        const summary = modalLink.dataset.summary;

        if (targetUrl) {
          window.showPreviewModal(targetUrl, name, country, summary);
        }
      }
    });

    // --------------------------------------------------------------------------
    // Modal close on clicking outside.
    // --------------------------------------------------------------------------
    document.body.addEventListener("click", function(event) {
      if (
        event.target.classList.contains("fixed") &&
        event.target.classList.contains("inset-0")
      ) {
        event.target.remove();
      }
    });

    // --------------------------------------------------------------------------
    // Handle browser back button.
    // --------------------------------------------------------------------------
    window.addEventListener("popstate", function(event) {
      window.location.reload();
    });

    // --------------------------------------------------------------------------
    // HTMX event listeners for spinner management.
    // --------------------------------------------------------------------------
    document.body.addEventListener("htmx:beforeRequest", function(evt) {
      console.log('HTMX beforeRequest:', evt.detail.pathInfo?.requestPath);
      layoutshowSpinner();
    });

    document.body.addEventListener("htmx:afterRequest", function(evt) {
      console.log('HTMX afterRequest - hiding spinner');
      hideSpinner();
    });

    document.body.addEventListener("htmx:responseError", function(evt) {
      console.log('HTMX responseError - hiding spinner');
      hideSpinner();
    });

    // Global error handler to ensure spinner state consistency.
    window.addEventListener("error", function(event) {
      console.error("Global error:", event.error);
      hideSpinner();
      searchInProgress = false;
    });

    // --------------------------------------------------------------------------
    // Close table dropdowns when clicking outside.
    // --------------------------------------------------------------------------
    document.addEventListener("click", function(event) {
      if (
        !event.target.closest("th .dropdown-content") &&
        !event.target.closest("th button")
      ) {
        document.querySelectorAll("th .dropdown-content").forEach(function(d) {
          d.classList.add("hidden");
        });
      }
    });

    // --------------------------------------------------------------------------
    // Adjust "fecha-de-cierre" elements.
    // --------------------------------------------------------------------------
    document.querySelectorAll(".fecha-de-cierre").forEach(function(element) {
      if (element.textContent.trim() === "Sin Cierre") {
        element.textContent = "Confirmar";
        element.classList.add("confirmar");
      }
      element.classList.add("text-center");
    });

    // --------------------------------------------------------------------------
    // Mobile-specific adjustments for touch scrolling.
    // --------------------------------------------------------------------------
    if (window.innerWidth <= 1024) {
      var scrollContainers = document.querySelectorAll(
        "#results-container > div, .max-h-\\[35rem\\]"
      );
      scrollContainers.forEach(function(container) {
        container.addEventListener("touchmove", function(e) {
          e.stopPropagation();
        }, { passive: true });
      });
    }

    // --------------------------------------------------------------------------
    // HTMX event listeners for handling responses
    // --------------------------------------------------------------------------
    document.body.addEventListener('htmx:afterRequest', function(evt) {
        console.log('HTMX afterRequest event:', {
            successful: evt.detail.successful,
            failed: evt.detail.failed,
            target: evt.detail.target?.id,
            path: evt.detail.pathInfo?.requestPath
        });

        // Check if this was a successful save request
        if (evt.detail.successful && 
            evt.detail.pathInfo?.requestPath === '/save_user_opportunity') {
            
            console.log('Save was successful, showing alert');
            window.showAlert(MESSAGES.SAVED, 'success');
            
            // Uncheck ALL checkboxes
            document.querySelectorAll('input[type="checkbox"][hx-trigger="click"]:checked').forEach(checkbox => {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            });
        }
    });

    // --------------------------------------------------------------------------
    // Keep the existing beforeSwap listener but remove the notification handling
    // --------------------------------------------------------------------------
    document.body.addEventListener('htmx:beforeSwap', function(evt) {
        if (evt.detail.target?.id === 'notification') {
            evt.detail.shouldSwap = false;
        }
    });

    // --------------------------------------------------------------------------
    // Add spinner handling for save operations
    // --------------------------------------------------------------------------
    document.body.addEventListener('htmx:beforeRequest', function(evt) {
        if (evt.detail.pathInfo?.requestPath === '/save_user_opportunity') {
            layoutshowSpinner();
        }
    });

    // First, let's verify the spinner exists when the page loads
    const spinner = document.getElementById('layout-spinner');
    console.log('Initial spinner check:', spinner);
    if (!spinner) {
        const spinners = document.getElementsByClassName('spinner');
        console.log('Found spinners by class:', spinners.length);
    }

    // Add HTMX delete handler with confirmation
    document.body.addEventListener('htmx:beforeRequest', function(evt) {
        const requestPath = evt.detail.requestConfig?.path || '';
        
        if (requestPath.startsWith('/delete_opportunity/')) {
            const spinner = document.getElementById('layout-spinner');
            if (spinner) spinner.style.display = 'block';
            
            if (!confirm('¿Estás seguro de que deseas eliminar esta oportunidad?')) {
                evt.preventDefault();
                if (spinner) spinner.style.display = 'none';
            }
        }
    });

    document.body.addEventListener('htmx:afterRequest', function(evt) {
        const requestPath = evt.detail.requestConfig?.path || '';
        const pathInfo = evt.detail.pathInfo?.requestPath || '';
        
        console.log('HTMX afterRequest event:', {
            successful: evt.detail.successful,
            failed: evt.detail.failed,
            target: evt.detail.target?.id,
            path: requestPath || pathInfo
        });

        // Check if this was a successful save request
        if (evt.detail.successful && 
            (requestPath === '/save_user_opportunity' || requestPath === '/save_from_modal')) {
            console.log('Save was successful, showing alert');
            window.showAlert(MESSAGES.SAVED, 'success');
        }

        // Check if this was a delete operation
        if (requestPath.startsWith('/delete_opportunity/')) {
            const spinner = document.getElementById('layout-spinner');
            if (spinner) spinner.style.display = 'none';
            
            if (evt.detail.successful) {
                showAlert("Oportunidad eliminada correctamente", "success");
            } else if (evt.detail.failed) {
                showAlert("Error al eliminar oportunidad", "error");
            }
        }
    });

    // Add error handler
    document.body.addEventListener('htmx:targetError', function(evt) {
        console.error('HTMX target error:', evt.detail);
        window.location.reload(); // Fallback refresh
    });

    // ============================================================================
    // Module: Test Filters
    // ============================================================================
    
    let prefilteredResults = null;
    let allPages = null;

    function handleDisciplineFilter(button) {
        const disciplineButtons = document.querySelectorAll('[data-discipline-filter]');
        
        // Update active state
        disciplineButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('border-gray-300', 'text-gray-700');
        });
        button.classList.add('bg-blue-600', 'text-white');
        button.classList.remove('border-gray-300', 'text-gray-700');
        
        // Show filtered results
        const discipline = button.dataset.disciplineFilter;
        if (discipline === 'todos') {
            showResults(allPages);
        } else {
            showFilteredResults(discipline);
        }
    }

    function handleMonthFilter(button) {
        const monthButtons = document.querySelectorAll('[data-month-filter]');
        const month = button.dataset.monthFilter;
        
        // Update active state
        monthButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('border-gray-300', 'text-gray-700');
        });
        button.classList.add('bg-blue-600', 'text-white');
        button.classList.remove('border-gray-300', 'text-gray-700');
        
        if (month === 'todos') {
            showResults(allPages);
        } else {
            // Filter by month
            const filteredPages = allPages.filter(page => {
                if (!page.fecha_de_cierre || page.fecha_de_cierre === '1900-01-01') return false;
                const pageMonth = new Date(page.fecha_de_cierre).getMonth() + 1;
                return pageMonth === parseInt(month);
            });
            showResults(filteredPages);
        }
    }

    function showFilteredResults(discipline) {
        const results = prefilteredResults[discipline] || [];
        showResults(results);
    }

    function showResults(results) {
        const container = document.getElementById('results-container');
        const counter = document.getElementById('results-counter');
        
        if (counter) {
            counter.textContent = `${results.length} oportunidades ordenadas por fecha de cierre (más próximas primero)`;
        }
        
        if (container) {
            container.innerHTML = results.map(page => {
                const nombre = escapeHTML(page.nombre || 'Sin nombre');
                const resumida = escapeHTML(page.og_resumida || '');
                const pais = escapeHTML(page.país || '');
                const url = escapeHTML(page.url);
                
                return `
                    <div class="opportunity-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h3 class="font-bold text-lg mb-2">${nombre}</h3>
                        <p class="text-sm text-gray-600 mb-2">${resumida}</p>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-500">${pais}</span>
                            <button 
                                onclick="showPreviewModal('${url}', '${nombre}', '${pais}', '${resumida}', '${escapeHTML(page.id || '')}')"
                                class="text-blue-600 hover:underline text-sm">
                                Ver más
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    let activeFilters = {
        categories: new Set(),
        country: null,
        month: null
    };

    // Initialize dropdowns on load
    function initializeStructuredFilters() {
        // Country dropdown
        const countryFilter = document.getElementById('country-filter');
        const uniqueCountries = [...new Set(allPages.map(p => p.país).filter(Boolean))].sort();
        uniqueCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilter.appendChild(option);
        });

        // Month dropdown
        const monthFilter = document.getElementById('month-filter');
        if (monthFilter) {
            Object.entries(month_mapping).forEach(([monthName, monthNumber]) => {
                const option = document.createElement('option');
                option.value = monthNumber;
                option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                monthFilter.appendChild(option);
            });
        }
    }

    // Initialize filters if we're on the test page
    const preFilteredData = document.getElementById('prefiltered-data');
    if (preFilteredData) {
        try {
            // Use a temporary parser to decode HTML entities
            const tempParser = new DOMParser();
            const resultsString = tempParser.parseFromString(preFilteredData.dataset.results, 'text/html').body.textContent;
            const pagesString = tempParser.parseFromString(preFilteredData.dataset.pages, 'text/html').body.textContent;
            
            const results = JSON.parse(resultsString);
            const pages = JSON.parse(pagesString);
            
            console.log('Initializing filters with:', { 
                resultCount: Object.keys(results).length,
                pageCount: pages.length,
                firstResult: Object.keys(results)[0],
                firstPage: pages[0]
            });
            
            prefilteredResults = results;
            allPages = pages;
            
            // Show initial results
            showResults(allPages);
            
            // Initialize button states
            document.querySelectorAll('[data-discipline-filter="todos"]').forEach(btn => {
                btn.classList.add('bg-blue-600', 'text-white');
            });
            document.querySelectorAll('[data-month-filter="todos"]').forEach(btn => {
                btn.classList.add('bg-blue-600', 'text-white');
            });

            // Initialize the dropdowns
            initializeStructuredFilters();

        } catch (e) {
            console.error('Filter initialization error:', e);
        }
    }

    // Add these event listeners in the DOMContentLoaded callback
    document.querySelectorAll('[data-discipline-filter]').forEach(button => {
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                handleDisciplineFilter(button);
            });
        }
    });

    document.querySelectorAll('[data-month-filter]').forEach(button => {
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                handleMonthFilter(button);
            });
        }
    });

    // Event listeners for dropdown changes
    const countryFilter = document.getElementById('country-filter');
    if (countryFilter) {
        countryFilter.addEventListener('change', () => {
            activeFilters.country = countryFilter.value || null;
        });
    }

    const monthFilter = document.getElementById('month-filter');
    if (monthFilter) {
        monthFilter.addEventListener('change', () => {
            activeFilters.month = monthFilter.value || null;
        });
    }

    // Category filter buttons
    document.querySelectorAll('.category-filter-btn').forEach(button => {
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const category = button.dataset.category;
                
                button.classList.toggle('bg-blue-600');
                button.classList.toggle('text-white');
                button.classList.toggle('border-blue-600');
                
                if (activeFilters.categories.has(category)) {
                    activeFilters.categories.delete(category);
                } else {
                    activeFilters.categories.add(category);
                }
            });
        }
    });

    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performSearch();
            const filtersElement = document.getElementById('structured-filters');
            if (filtersElement) {
                filtersElement.classList.add('hidden');
            }
        });
    }

    // --------------------------------------------------------------------------
    // Final corrected preferences form handling
    // --------------------------------------------------------------------------
    let preferencesForm = document.querySelector('form[data-form-type="preferences"]');
    if (preferencesForm) {
        console.log('Found preferences form, attaching submit handler');
        preferencesForm.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            
            // Client-side validation
            if (!this.checkValidity()) {
                console.log('Form validation failed');
                return true;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const notification = document.getElementById('notification');
            
            console.log('Form elements:', {
                submitBtn: submitBtn,
                notification: notification,
                formAction: this.action,
                formMethod: this.method
            });
            
            // Show global spinner and disable button
            console.log('Attempting to show spinner');
            window.layoutshowSpinner();
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Guardando...';
                console.log('Submit button disabled and text updated');
            }

            // Show redirecting notification
            if (notification) {
                notification.innerHTML = '<div class="alert alert-info">Redirigiendo...</div>';
                notification.classList.remove('hidden');
                console.log('Notification displayed');
            }
            
            // Fallback cleanup in case submission fails
            window.addEventListener('unload', function() {
                console.log('Unload event triggered');
                window.hideSpinner();
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Guardar Preferencias';
                }
                if (notification) {
                    notification.classList.add('hidden');
                }
            });

            console.log('Form submission proceeding normally');
            return true;
        });
    } else {
        console.log('Preferences form not found in DOMContentLoaded');
    }

    // Log initial elements state
    console.log('Initial elements state:', {
        spinner: document.getElementById('layout-spinner'),
        notification: document.getElementById('notification'),
        preferencesForm: document.querySelector('form[data-form-type="preferences"]')
    });

    // Add to the top of the file with other constants
    const AUTOCOMPLETE_DATA = {
        disciplines: ['visuales', 'música', 'video', 'escénicas', 'literatura', 'diseño', 'investigación', 'arquitectura'],
        subdisciplines: [
            'pintura', 'escultura', 'fotografía', 'danza', 'teatro', 'poesía', 
            'diseño gráfico', 'urbanismo', 'cerámica', 'performance', 'arte digital',
            'ilustración', 'gestión cultural', 'arquitectura', 'arte sonoro', 'cine',
            'animación', 'moda', 'curaduría'
        ],
        countries: [
            'España', 'Argentina', 'México', 'Colombia', 'EEUU', 'Reino Unido',
            'Italia', 'Francia', 'Alemania', 'Portugal', 'Múltiples países'
        ],
        categories: ['beca', 'premio', 'residencia', 'convocatoria', 'exposición', 'festival'],
        entities: [
            'Arquetopia', 'Datarte', 'LoosenArt', 'Fundación Botín', 'CEWE',
            'Festival Annecy', 'Pollock-Krasner Foundation', 'Guarimba Film Festival'
        ]
    };

    // Add these helper functions
    function initAutocomplete() {
        const searchInput = document.getElementById('open-search');
        const autocompleteList = document.getElementById('autocomplete-list');

        if (!searchInput || !autocompleteList) return;

        searchInput.addEventListener('input', function(e) {
            const query = this.value.trim().toLowerCase();
            autocompleteList.innerHTML = '';
            autocompleteList.classList.add('hidden');

            if (query.length < 2) return;

            const suggestions = [];
            Object.entries(AUTOCOMPLETE_DATA).forEach(([category, items]) => {
                items.forEach(item => {
                    if (normalizeText(item).includes(normalizeText(query))) {
                        suggestions.push({ category, item });
                    }
                });
            });

            if (suggestions.length > 0) {
                autocompleteList.classList.remove('hidden');
                suggestions.slice(0, 7).forEach(({ category, item }) => {
                    const div = document.createElement('div');
                    div.className = 'px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm';
                    div.innerHTML = `
                        <span class="text-gray-500 text-xs">${category}:</span>
                        <span class="ml-2 text-gray-700">${highlightMatch(item, query)}</span>
                    `;
                    div.onclick = () => {
                        searchInput.value = item;
                        autocompleteList.classList.add('hidden');
                        // Use the existing search mechanism
                        if (searchInput.value.length >= 3) {
                            htmx.ajax("GET", "/database?search=" + encodeURIComponent(item), {
                                target: "#search-results",
                                swap: "innerHTML",
                                headers: { "HX-Request": "true" },
                            });
                        }
                    };
                    autocompleteList.appendChild(div);
                });
            }
        });

        // Close autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-container')) {
                autocompleteList.classList.add('hidden');
            }
        });
    }

    function highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="font-semibold text-cyan-600">$1</span>');
    }

    // Update the DOMContentLoaded event listener to include autocomplete initialization
    document.addEventListener("DOMContentLoaded", function() {
        // Add this line to initialize autocomplete
        initAutocomplete();
        
        // ... rest of your existing DOMContentLoaded code ...
    });

    // Preview button handler (safe event delegation)
    document.body.addEventListener('click', function(e) {
        const previewBtn = e.target.closest('.preview-btn');
        if (previewBtn) {
            e.preventDefault();
            const url = previewBtn.dataset.url;
            const name = previewBtn.dataset.name;
            const country = previewBtn.dataset.country;
            const summary = previewBtn.dataset.summary;
            const id = previewBtn.dataset.id;
            showPreviewModal(url, name, country, summary, id);
        }
    });

    // Filter dropdown trigger (with existence check)
    const filterTrigger = document.getElementById('filter-dropdown-trigger');
    const structuredFilters = document.getElementById('structured-filters');
    if (filterTrigger && structuredFilters) {
        filterTrigger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            structuredFilters.classList.toggle('hidden');
        });

        // Close dropdown click handler
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#structured-filters') && 
                !e.target.closest('#filter-dropdown-trigger')) {
                structuredFilters.classList.add('hidden');
            }
        });
    }

    // Add null check for ALL remaining elements
    const ALL_EVENT_HANDLERS = [
        { selector: '[data-discipline-filter]', event: 'click', handler: handleDisciplineFilter },
        { selector: '[data-month-filter]', event: 'click', handler: handleMonthFilter },
        { selector: '.category-filter-btn', event: 'click', handler: handleCategoryFilter },
        { selector: '#apply-filters', event: 'click', handler: handleApplyFilters }
    ];

    ALL_EVENT_HANDLERS.forEach(({ selector, event, handler }) => {
        document.querySelectorAll(selector).forEach(element => {
            if (element) {
                element.addEventListener(event, handler);
            }
        });
    });

    // Log the state of elements after DOMContentLoaded
    console.log('DOMContentLoaded - Elements state:', {
        spinner: document.getElementById('layout-spinner'),
        notification: document.getElementById('notification'),
        preferencesForm: document.querySelector('form[data-form-type="preferences"]'),
        filterTrigger: document.getElementById('filter-dropdown-trigger'),
        structuredFilters: document.getElementById('structured-filters')
    });

    // Append this near the global initialization code
    window.addEventListener("pageshow", function(event) {
        console.log("Pageshow event fired. Hiding the spinner if visible.");
        // Access the spinner element and ensure it's hidden.
        var spinner = document.getElementById("layout-spinner");
        if (spinner) {
            spinner.style.display = "none";
        }
    });

    // Add this to your HTMX configuration
    document.body.addEventListener('htmx:responseError', function(evt) {
        console.error('HTMX Error:', evt.detail);
        showAlert("Error al guardar la oportunidad", "error");
    });

    document.body.addEventListener('htmx:sendError', function(evt) {
        console.error('HTMX Send Error:', evt.detail);
        showAlert("Error de conexión", "error");
    });
  });

  // ============================================================================
  // Module: HTMX Global Configuration
  // ============================================================================

  if (typeof htmx !== "undefined") {
    htmx.config.defaultSwapStyle = "innerHTML";
    htmx.config.defaultTarget = "#search-results";
  }

  /**
   * Redirects the user to the login page.
   * Modify '/login' to match your application's login route if necessary.
   */
  window.redirectToLogin = function() {
    window.location.href = "/login";
  };

  // Constants for messages
  const MESSAGES = {
    SAVED: "Oportunidad guardada exitosamente",
    DELETED: "Oportunidad eliminada exitosamente",
    ERROR: "Ha ocurrido un error. Por favor, inténtalo de nuevo."
  };

  // Attach showAlert to window object explicitly
  window.showAlert = function(message, type = 'success') {
    const container = document.getElementById('alert-container');
    if (!container) return;

    // Clear previous alerts
    container.innerHTML = '';

    const alert = document.createElement('div');
    // Simple inline styles instead of classes
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 4px;
        background: ${type === 'success' ? '#d1fae5' : '#fee2e2'};
        color: ${type === 'success' ? '#065f46' : '#991b1b'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 9999;
    `;

    alert.innerHTML = `
        <svg style="flex-shrink:0; width:20px; height:20px;" viewBox="0 0 24 24" fill="none">
            ${type === 'success' ? `
                <path stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            ` : `
                <path stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            `}
        </svg>
        <span style="font-size:14px; font-weight:500;">${message}</span>
    `;

    container.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 3000);
  };

  // Define handleCategoryFilter function
  function handleCategoryFilter(e) {
    e.preventDefault();
    const category = e.target.dataset.category;

    // Toggle category filter logic
    if (activeFilters.categories.has(category)) {
        activeFilters.categories.delete(category);
    } else {
        activeFilters.categories.add(category);
    }

    // Update UI or perform other actions
    console.log('Category filter updated:', Array.from(activeFilters.categories));
  }

  // Define the handleApplyFilters function
  function handleApplyFilters(e) {
    e.preventDefault();
    // Assuming performSearch() is defined elsewhere and executes the search
    performSearch();
    
    // Hide the structured filters
    const filtersElement = document.getElementById('structured-filters');
    if (filtersElement) {
        filtersElement.classList.add('hidden');
    }
    console.log('Applied filters');
  }
})();