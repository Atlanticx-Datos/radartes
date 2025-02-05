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
   */
  window.showPreviewModal = function(url, name, country, summary) {
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
  window.layoutshowSpinner = function(event) {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.style.display = 'block';
    }
  };

  // Hide spinner function
  window.hideSpinner = function() {
    const spinner = document.getElementById('layout-spinner');
    if (spinner) {
        spinner.style.display = 'none';
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
      // Listen for clicks on elements with any of the relevant classes.
      var modalLink = event.target.closest(".opportunity-link, .destacada-link, .cierran-pronto-link");
      if (modalLink) {
        event.preventDefault();
        event.stopPropagation();

        // Ensure we have the element that contains the data attributes.
        // In "cierran pronto" cases, the outer anchor may not have them so we search within.
        if (!modalLink.getAttribute("data-url")) {
          var nested = modalLink.querySelector("[data-url]");
          if (nested) {
            modalLink = nested;
          }
        }

        var targetUrl = modalLink.getAttribute("data-url");
        var name = modalLink.getAttribute("data-name");
        var country = modalLink.getAttribute("data-country");
        var summary = modalLink.getAttribute("data-summary");

        console.log("Triggering modal with data:", { targetUrl, name, country, summary });

        if (!targetUrl) {
          console.error("No URL found for the opportunity.");
          return;
        }
        window.showPreviewModal(targetUrl, name, country, summary);
      }
    });

    // --------------------------------------------------------------------------
    // Clear search button click handling.
    // --------------------------------------------------------------------------
    document.body.addEventListener("click", function(event) {
      var clearButton = event.target.closest('[onclick="clearSearch()"]');
      if (clearButton) {
        event.preventDefault();
        window.location.href = "/database";
        return false;
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

  // Unified opportunity management functions
  window.opportunityHandler = {
    // Handle save operations
    save: function(checkbox) {
      layoutshowSpinner();
      const opportunityId = checkbox.value;
      const isSaved = checkbox.checked;
      
      fetch(`/save_user_opportunity/${opportunityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ save: isSaved })
      })
      .then(response => {
        if (!response.ok) throw new Error(MESSAGES.ERROR);
        return response.json();
      })
      .then(data => {
        window.showAlert(MESSAGES.SAVED, 'success');
        checkbox.checked = false; // Always uncheck after save
      })
      .catch(error => {
        window.showAlert(error.message, 'error');
        checkbox.checked = false;
      })
      .finally(() => {
        hideSpinner();
      });
    },

    // Handle delete operations
    delete: function(opportunityId) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta oportunidad?')) return;
        
        // Show spinner using the layout function
        layoutshowSpinner();
        
        fetch(`/delete_opportunity/${opportunityId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.status === 204) {
                this.removeRow(opportunityId);
                window.showAlert(MESSAGES.DELETED, 'success');
            } else {
                throw new Error(MESSAGES.ERROR);
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            window.showAlert(error.message, 'error');
        })
        .finally(() => {
            // Hide spinner when complete
            hideSpinner();
        });
    },

    // DOM manipulation methods
    removeRow: function(opportunityId) {
      const row = document.querySelector(`tr[data-opportunity-id="${opportunityId}"]`);
      if (row) {
        row.remove();
        this.checkEmptyState();
      }
    },

    checkEmptyState: function() {
      const tbody = document.getElementById('my-results');
      if (tbody && tbody.children.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="p-2 text-center">
              No se encontraron oportunidades guardadas.
            </td>
          </tr>
        `;
      }
    }
  };

  // Keep legacy function names for HTML compatibility
  window.deleteOpportunity = function(opportunityId) {
    window.opportunityHandler.delete(opportunityId);
  };

  // Modified event delegation to handle both old and new HTML
  document.addEventListener('DOMContentLoaded', function() {
    // Handle both old onclick="deleteOpportunity()" and new data attributes
    document.body.addEventListener('click', function(e) {
      const deleteButton = e.target.closest('[data-delete-opportunity], [onclick*="deleteOpportunity("]');
      if (deleteButton) {
        let opportunityId;
        
        // New data attribute format
        if (deleteButton.dataset.deleteOpportunity) {
          opportunityId = deleteButton.dataset.deleteOpportunity;
        }
        // Legacy onclick format
        else if (deleteButton.onclick) {
          const match = deleteButton.onclick.toString().match(/deleteOpportunity\('([^']+)'\)/);
          opportunityId = match ? match[1] : null;
        }
        
        if (opportunityId) {
          window.opportunityHandler.delete(opportunityId);
        }
      }
    });

    // Existing checkbox handler remains the same
    document.body.addEventListener('click', function(e) {
      if (e.target.matches('input[type="checkbox"][hx-trigger="click"]')) {
        window.opportunityHandler.save(e.target);
      }
    });
  });
})();