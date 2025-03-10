import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';

// Handles modal functionality
export const ModalModule = {
    // Helper function to extract the title from nombre_original
    extractTitle(nombre) {
        let title = '';
        
        // Check if nombre exists and is a string
        if (nombre && typeof nombre === 'string') {
            // Define all possible separator characters
            const separators = [
                { char: '︱', name: 'PRESENTATION FORM FOR VERTICAL EM DASH', code: 0xFE31 },
                { char: '⎮', name: 'INTEGRAL EXTENSION', code: 0x23AE },
                { char: '|', name: 'VERTICAL LINE', code: 0x007C },
                { char: '｜', name: 'FULLWIDTH VERTICAL LINE', code: 0xFF5C },
                { char: '│', name: 'BOX DRAWINGS LIGHT VERTICAL', code: 0x2502 },
                { char: '┃', name: 'BOX DRAWINGS HEAVY VERTICAL', code: 0x2503 },
                { char: '┊', name: 'BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL', code: 0x250A },
                { char: '┋', name: 'BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL', code: 0x250B }
            ];
            
            // Find the first separator that exists in the string
            let foundSeparator = null;
            let separatorIndex = -1;
            
            for (const separator of separators) {
                const index = nombre.indexOf(separator.char);
                if (index !== -1) {
                    foundSeparator = separator;
                    separatorIndex = index;
                    break;
                }
            }
            
            // If we found a separator, split the string
            if (foundSeparator) {
                // Get the parts before and after the separator
                const category = nombre.substring(0, separatorIndex).trim();
                const name = nombre.substring(separatorIndex + 1).trim();
                
                if (name) {
                    title = name;
                } else {
                    // If there's nothing after the separator, use the original name
                    title = nombre.trim() || 'Sin título';
                }
            } else {
                // If no separator found, check if the title starts with a known category
                const knownCategories = ['Beca', 'Convocatoria', 'Premio', 'Residencia', 'Concurso', 'Oportunidad'];
                let foundCategory = false;
                
                for (const category of knownCategories) {
                    if (nombre.startsWith(category)) {
                        // Try to extract a title after the category
                        const afterCategory = nombre.substring(category.length).trim();
                        if (afterCategory) {
                            title = afterCategory;
                            foundCategory = true;
                            break;
                        }
                    }
                }
                
                if (!foundCategory) {
                    // Use the original name as fallback
                    title = nombre.trim();
                }
            }
        } else {
            // Fallback if nombre is not available
            title = 'Sin título';
        }
        
        return title;
    },

    showPreviewModal(url, nombre, pais, og_resumida, id, categoria, base_url, requisitos, disciplina_param, fecha_cierre_param, inscripcion_param) {
        try {
            console.log('DETAILED DATE DEBUG - Modal Input:', {
                fecha_cierre_param: fecha_cierre_param,
                fecha_cierre_param_type: typeof fecha_cierre_param,
                fecha_cierre_param_length: fecha_cierre_param ? fecha_cierre_param.length : 0,
                fecha_cierre_param_chars: fecha_cierre_param ? Array.from(fecha_cierre_param).map(c => c.charCodeAt(0)) : []
            });
            
            // Clean up any existing modals first
            const existingModals = document.querySelectorAll('[id^="modal-"]');
            const existingOverlays = document.querySelectorAll('[id$="-overlay"]');
            
            existingModals.forEach(modal => modal.remove());
            existingOverlays.forEach(overlay => overlay.remove());

            const modalId = "modal-" + Date.now();
            const isMiEspacio = window.location.pathname === '/mi_espacio';

            // Create an overlay element to darken the background and capture clicks
            const overlay = document.createElement("div");
            overlay.id = modalId + "-overlay";
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.3);
                backdrop-filter: blur(4px);
                z-index: 50;
                opacity: 0;
                transition: opacity 300ms ease-out;
            `;

            // Create the modal container with responsive styling
            const modalContent = document.createElement("div");
            modalContent.id = modalId;
            modalContent.dataset.baseUrl = base_url || '';
            modalContent.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -45%);
                z-index: 51;
                opacity: 0;
                transition: opacity 300ms ease-out, transform 300ms ease-out;
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow-y: auto;
            `;

            // Get CSRF token safely
            const csrfInput = document.querySelector('input[name="csrf_token"]');
            const csrfToken = csrfInput ? Utils.escapeHTML(csrfInput.value) : '';
            
            // Find the clicked element that triggered the modal
            // Look for both opportunity-card and opportunity-preview classes, as well as preview-btn
            let clickedElement = document.querySelector(`.opportunity-card[data-id="${id}"]`) || 
                                document.querySelector(`.opportunity-preview[data-id="${id}"]`) ||
                                document.querySelector(`.preview-btn[data-id="${id}"]`);
            
            // If we still can't find it, try to find the most recently clicked button with relevant data
            if (!clickedElement) {
                const previewButtons = document.querySelectorAll('.preview-btn, .opportunity-preview');
                previewButtons.forEach(btn => {
                    if (btn.dataset.id === id || btn.dataset.nombre === nombre || btn.dataset.name === nombre) {
                        clickedElement = btn;
                    }
                });
            }
            
            // Get additional data from the clicked element if available, or use provided parameters
            const inscripcion = inscripcion_param || clickedElement?.dataset?.inscripcion || '';
            
            // Extract the title using the same logic as in destacar.js
            const displayTitle = this.extractTitle(nombre);
            
            // Format date function with enhanced debugging
            const formatDate = (dateStr) => {
                try {
                    console.log('DETAILED DATE DEBUG - formatDate input:', {
                        dateStr: dateStr,
                        type: typeof dateStr,
                        length: dateStr ? dateStr.length : 0,
                        chars: dateStr ? Array.from(dateStr).map(c => c.charCodeAt(0)) : [],
                        stringified: JSON.stringify(dateStr)
                    });
                    
                    // Handle empty or special values
                    if (!dateStr || dateStr === '1900-01-01' || dateStr === 'null' || dateStr === 'undefined' || dateStr === '') {
                        console.log('Date is empty or default value, returning fallback');
                        return 'Confirmar en bases';
                    }
                    
                    // If the string contains "Confirmar en bases", return it as is
                    if (typeof dateStr === 'string' && dateStr.includes('Confirmar en bases')) {
                        console.log('Date contains "Confirmar en bases", returning as is');
                        return 'Confirmar en bases';
                    }
                    
                    // CRITICAL: Check if the date is already formatted with month abbreviation
                    // Format is typically DD/MMM/YYYY (e.g., 15/Ene/2023)
                    const monthAbbreviations = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    if (typeof dateStr === 'string') {
                        for (const month of monthAbbreviations) {
                            if (dateStr.includes(month)) {
                                console.log('Date appears to be already formatted with month abbreviation:', dateStr);
                                return dateStr;
                            }
                        }
                    }
                    
                    // Normalize the date string - remove extra spaces and quotes
                    const normalizedDateStr = String(dateStr || '').trim().replace(/^["']|["']$/g, '');
                    console.log('Normalized date string:', normalizedDateStr);
                    
                    // If empty after normalization, return fallback
                    if (!normalizedDateStr) {
                        return 'Confirmar en bases';
                    }
                    
                    // First try parsing as is
                    let date = new Date(normalizedDateStr);
                    console.log('First parse attempt result:', date, 'isValid:', !isNaN(date.getTime()));
                    
                    // If invalid, try converting from DD/MM/YYYY format
                    if (isNaN(date.getTime()) && normalizedDateStr.includes('/')) {
                        const parts = normalizedDateStr.split('/');
                        console.log('Trying DD/MM/YYYY format, parts:', parts);
                        
                        if (parts.length === 3) {
                            const [day, month, year] = parts;
                            date = new Date(`${year}-${month}-${day}`);
                            console.log('Second parse attempt result:', date, 'isValid:', !isNaN(date.getTime()));
                        }
                    }
                    
                    // If still invalid, try other common formats
                    if (isNaN(date.getTime()) && normalizedDateStr.includes('-')) {
                        console.log('Trying dash format');
                        // Already in YYYY-MM-DD format, but might need trimming
                        date = new Date(normalizedDateStr);
                        console.log('Third parse attempt result:', date, 'isValid:', !isNaN(date.getTime()));
                    }
                    
                    // If still invalid, try one more format: DD-MM-YYYY
                    if (isNaN(date.getTime()) && normalizedDateStr.includes('-')) {
                        const parts = normalizedDateStr.split('-');
                        console.log('Trying DD-MM-YYYY format, parts:', parts);
                        
                        if (parts.length === 3) {
                            const [day, month, year] = parts;
                            date = new Date(`${year}-${month}-${day}`);
                            console.log('Fourth parse attempt result:', date, 'isValid:', !isNaN(date.getTime()));
                        }
                    }
                    
                    // If still invalid, return the original string or fallback
                    if (isNaN(date.getTime())) {
                        console.warn('All date parsing attempts failed for:', normalizedDateStr);
                        return 'Confirmar en bases';
                    }
                    
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
                    const formattedDate = `${day}/${monthMap[date.getMonth()]}/${year}`;
                    console.log('Formatted date result:', formattedDate);
                    return formattedDate;
                } catch (e) {
                    console.error('Error in formatDate:', e);
                    return 'Confirmar en bases';
                }
            };
            
            // Get the closing date from the clicked element if available or use provided parameter
            // Try all possible attribute names and formats
            let fechaCierre = '';
            try {
                // CRITICAL: First check if the parameter is a formatted date with month abbreviation
                // This would be the case if we're getting the date directly from the table cell
                if (fecha_cierre_param && typeof fecha_cierre_param === 'string') {
                    const monthAbbreviations = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    for (const month of monthAbbreviations) {
                        if (fecha_cierre_param.includes(month)) {
                            console.log('Parameter appears to be a formatted date:', fecha_cierre_param);
                            fechaCierre = fecha_cierre_param;
                            break;
                        }
                    }
                }
                
                // If we didn't find a formatted date, try other sources
                if (!fechaCierre) {
                    // First, try to use the parameter passed directly to the function
                    if (fecha_cierre_param && fecha_cierre_param !== 'undefined' && fecha_cierre_param !== 'null') {
                        fechaCierre = fecha_cierre_param;
                    } 
                    // If no parameter or it's invalid, try to get it from the clicked element
                    else if (clickedElement) {
                        // Try dataset properties first (camelCase)
                        fechaCierre = clickedElement.dataset.fechaCierreFormatted ||
                                     clickedElement.dataset.fechaCierre || 
                                     clickedElement.dataset.fecha_cierre || 
                                     clickedElement.dataset.fechacierre || 
                                     clickedElement.dataset.fechaDeCierre || 
                                     clickedElement.dataset.fechaCierreRaw || '';
                        
                        // If still no date, try direct attributes (kebab-case)
                        if (!fechaCierre || fechaCierre === '1900-01-01') {
                            fechaCierre = clickedElement.getAttribute('data-fecha-cierre-formatted') ||
                                         clickedElement.getAttribute('data-fecha-cierre') || 
                                         clickedElement.getAttribute('data-fecha_cierre') || 
                                         clickedElement.getAttribute('data-fechacierre') || 
                                         clickedElement.getAttribute('data-fecha-de-cierre') || 
                                         clickedElement.getAttribute('data-fecha-cierre-raw') || '';
                        }
                    }
                }
                
                // Ensure fechaCierre is a string and trim it
                fechaCierre = String(fechaCierre || '').trim();
                
                // If the date is the placeholder date, set it to empty to trigger the fallback
                if (fechaCierre === '1900-01-01') {
                    fechaCierre = '';
                }
            } catch (e) {
                console.error('Error getting fecha_cierre:', e);
                fechaCierre = '';
            }
            
            console.log('Modal fecha_cierre details:', {
                param: fecha_cierre_param,
                fromElement: clickedElement?.dataset?.fecha_cierre,
                formatted: clickedElement?.dataset?.fechaCierreFormatted || clickedElement?.getAttribute('data-fecha-cierre-formatted'),
                directAttribute: clickedElement?.getAttribute('data-fecha-cierre'),
                raw: clickedElement?.getAttribute('data-fecha-cierre-raw'),
                final: fechaCierre,
                type: typeof fechaCierre
            });
            
            // Get disciplinas from the clicked element if available or use provided parameter
            // Try all possible attribute names
            const disciplinas = disciplina_param || 
                               clickedElement?.dataset?.disciplinas || 
                               clickedElement?.dataset?.disciplina || 
                               '';
            
            console.log('Disciplinas data:', disciplinas);
            const disciplinasArray = disciplinas ? disciplinas.split(',').map(d => d.trim()).filter(Boolean) : [];
            console.log('Disciplinas array:', disciplinasArray);
            const mainDiscipline = disciplinasArray.length > 0 ? disciplinasArray[0] : '';
            const subdisciplines = disciplinasArray.length > 1 ? disciplinasArray.slice(1).join(', ') : '';
            
            // Log data for debugging
            console.log('Modal data:', {
                id,
                nombre,
                pais,
                categoria,
                fechaCierre,
                disciplinas,
                mainDiscipline,
                subdisciplines,
                clickedElement: clickedElement ? true : false,
                disciplina_param,
                fecha_cierre_param,
                inscripcion_param
            });
            
            // Get the category class for styling
            const getCategoryClass = (category) => {
                if (!category) return '';
                
                const categoryMap = {
                    'Beca': 'categoria-becas',
                    'Convocatoria': 'categoria-convocatorias',
                    'Premio': 'categoria-premios',
                    'Residencia': 'categoria-residencias',
                    'Fondo': 'categoria-fondos',
                    'Oportunidad': 'categoria-oportunidades',
                    'Apoyo': 'categoria-apoyos'
                };
                
                const normalizedCategory = category.trim().toLowerCase();
                
                for (const [key, className] of Object.entries(categoryMap)) {
                    if (normalizedCategory.includes(key.toLowerCase())) {
                        return className;
                    }
                }
                
                return '';
            };
            
            const categoryClass = getCategoryClass(categoria);
            
            modalContent.innerHTML = `
                <div class="bg-white rounded-lg shadow-lg overflow-hidden" style="border-radius: 12px;">
                    <!-- New Header Section with Category and Share Icon -->
                    <div class="px-6 py-3 flex justify-between items-center" style="height: 44px;">
                        <div class="flex items-center">
                            <span class="text-sm font-medium text-white px-3 py-1 rounded-full" style="background-color: #6366F1; margin-top: 24px;">${Utils.escapeHTML(categoria || '')}</span>
                        </div>
                        <div class="flex items-center" style="margin-right: 12px;">
                            <button type="button" class="share-toggle-btn flex items-center justify-center rounded-full" style="width: 32px; height: 32px; background-color: rgba(99, 102, 241, 0.2);">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#6366F1" style="transform: rotate(45deg);">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <div class="share-dropdown hidden absolute right-4 top-16 mt-1 w-40 bg-white border rounded-md shadow-lg z-52">
                            <button class="share-option w-full text-left px-4 py-2 hover:bg-gray-100" data-action="copy">
                                Copiar URL
                            </button>
                            <a href="#" class="share-option block px-4 py-2 hover:bg-gray-100" data-action="whatsapp">
                                WhatsApp
                            </a>
                            <a href="#" class="share-option block px-4 py-2 hover:bg-gray-100" data-action="linkedin">
                                LinkedIn
                            </a>
                            <a href="#" class="share-option block px-4 py-2 hover:bg-gray-100" data-action="email">
                                Email
                            </a>
                        </div>
                    </div>

                    <!-- Title and Details Section -->
                    <div class="px-6 pt-5 pb-3" style="height: 120px; overflow-y: auto;">
                        <!-- Title -->
                        <h3 style="font-family: Inter; font-weight: 700; font-size: 18px; line-height: 150%; letter-spacing: 0%; color: #1F1B2D; margin-bottom: 8px;">
                            ${Utils.escapeHTML(displayTitle || nombre || '')}
                        </h3>
                        
                        <!-- Inline Details: Location, Payment, Subdisciplines -->
                        <div class="flex flex-col gap-1" style="font-family: Inter; font-weight: 400; font-size: 12px; color: #666276; line-height: 150%; letter-spacing: 0%;">
                            <!-- First row: Location, Payment, and Main Discipline -->
                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                                    </svg>
                                    <span>${Utils.escapeHTML(pais || '')}</span>
                                </div>
                                
                                <div class="flex items-center gap-1">
                                    ${inscripcion === 'Sin cargo' || !inscripcion ? 
                                        '<div class="relative inline-block"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg><svg class="absolute top-0 left-0 w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="5" x2="19" y2="19"/></svg></div>' : 
                                        '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5C15 8.7 14.3 8 13.5 8h-3C9.7 8 9 8.7 9 9.5S9.7 11 10.5 11h3c0.8 0 1.5 0.7 1.5 1.5v0c0 0.8-0.7 1.5-1.5 1.5h-3C9.7 14 9 14.7 9 15.5"/></svg>'
                                    }
                                </div>
                                
                                <!-- Show all disciplines in a comma-separated list -->
                                <div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                                    </svg>
                                    <span>${Utils.escapeHTML(disciplinasArray.join(', ') || '')}</span>
                                </div>
                            </div>
                            
                            <!-- Always show closing date -->
                            <div class="flex items-center gap-1 mt-1">
                                <svg class="w-3 h-3" viewBox="0 0 20 20" fill="#6232FF">
                                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                </svg>
                                <span style="font-weight: 700; color: #1F1B2D;">Cierre: ${formatDate(fechaCierre) || 'Confirmar en bases'}</span>
                                <!-- Debug info -->
                                <span class="hidden">Raw date: ${fechaCierre}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Resumen Section -->
                    <div class="px-6 pt-2 pb-4" style="overflow-y: auto;">
                        <div class="border-t" style="border-color: #D5D2DC; padding-top: 20px; margin-top: 0;">
                            <h4 style="font-family: Inter; font-weight: 700; font-size: 18px; line-height: 150%; letter-spacing: 0%; color: #666276; margin-bottom: 4px;">Resumen</h4>
                            <p style="font-family: Inter; font-weight: 400; font-size: 14px; line-height: 150%; letter-spacing: 0%; color: #666276;">${Utils.escapeHTML(og_resumida || '')}</p>
                            
                            <!-- Requisitos Section (if available) -->
                            ${requisitos ? `
                            <div style="border-top: 1px solid #D5D2DC; padding-top: 20px; margin-top: 20px;">
                                <h4 style="font-family: Inter; font-weight: 700; font-size: 18px; line-height: 150%; letter-spacing: 0%; color: #666276; margin-bottom: 4px;">Requisitos</h4>
                                <p style="font-family: Inter; font-weight: 400; font-size: 14px; line-height: 150%; letter-spacing: 0%; color: #666276;">${Utils.escapeHTML(requisitos)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- CTA Section -->
                    <div class="px-6 pt-2 pb-5" style="height: 108px;">
                        <div class="border-t" style="border-color: #D5D2DC; padding-top: 25px; margin-top: 0; display: flex; justify-content: flex-start; align-items: center; height: calc(100% - 25px);">
                            <a href="${Utils.escapeHTML(url)}" 
                               target="_blank" 
                               class="text-center rounded-full flex items-center justify-center"
                               style="height: 44px; width: 176px; background-color: white; color: black; border: 1px solid black; transition: all 0.3s;">
                                Ver oportunidad
                            </a>
                        </div>
                    </div>
                    <div id="save-notification" class="hidden"></div>
                    <input type="hidden" name="selected_pages" value="${id}">
                    <input type="hidden" name="csrf_token" value="${csrfToken}">
                </div>
            `;

            // Add to DOM
            document.body.appendChild(overlay);
            document.body.appendChild(modalContent);

            // Initialize HTMX on new content
            if (window.htmx) {
                htmx.process(modalContent);
            } else {
                console.error('HTMX not loaded');
            }

            // Force reflow to enable transitions
            overlay.offsetHeight;
            modalContent.offsetHeight;

            // Show with transitions
            overlay.style.opacity = "1";
            modalContent.style.opacity = "1";
            modalContent.style.transform = "translate(-50%, -50%)";

            // Setup close functionality
            const closeModal = () => {
                overlay.style.opacity = "0";
                modalContent.style.opacity = "0";
                modalContent.style.transform = "translate(-50%, -45%)";
                
                // Ensure spinner is hidden when modal is closed
                const spinner = document.getElementById('layout-spinner');
                if (spinner) spinner.classList.add('hidden');
                
                setTimeout(() => {
                    overlay.remove();
                    modalContent.remove();
                }, 300);
            };

            overlay.addEventListener('click', closeModal);

            // Setup share functionality
            const shareToggle = modalContent.querySelector('.share-toggle-btn');
            const shareDropdown = modalContent.querySelector('.share-dropdown');
            
            if (shareToggle && shareDropdown) {
                shareToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    shareDropdown.classList.toggle('hidden');
                });

                // Close dropdown when clicking outside
                document.addEventListener('click', () => shareDropdown.classList.add('hidden'));

                // Prevent dropdown from closing when clicking inside it
                shareDropdown.addEventListener('click', (e) => e.stopPropagation());

                // Handle share options
                shareDropdown.querySelectorAll('.share-option').forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.preventDefault();
                        const action = option.dataset.action;
                        this.handleShare(action, url, nombre);
                        shareDropdown.classList.add('hidden');
                    });
                });
            }
        } catch (e) {
            console.error('Error in showPreviewModal:', e);
        }
    },

    handleShare(platform, url, title) {
        // Create opportunity object with available data from the modal
        const modalElement = document.querySelector('[id^="modal-"]');
        if (!modalElement) {
            console.error('Modal element not found for sharing');
            return;
        }
        
        // Try to extract data from the modal content
        const countryElement = modalElement.querySelector('.flex.items-center svg[viewBox="0 0 20 20"] + *');
        const disciplinaElement = modalElement.querySelector('.flex.items-center svg[viewBox="0 0 20 20"] ~ .text-gray-600');
        
        // Check if we have a base_url from the modal element or from the clicked element
        const baseUrl = modalElement.dataset.baseUrl || '';
        
        // Use base_url if present, otherwise use the provided url
        const shareUrl = baseUrl || url;
        
        // Create opportunity object with available data
        const opportunity = {
            id: modalElement.querySelector('input[name="selected_pages"]')?.value || 'unknown',
            nombre: title,
            url: shareUrl,
            país: countryElement ? countryElement.textContent.trim() : '',
            disciplina: disciplinaElement ? disciplinaElement.textContent.trim() : '',
            fecha_de_cierre: '', // Not available in modal
            inscripcion: modalElement.querySelector('.flex.items-center svg.w-5.h-5') ? 
                (modalElement.querySelector('.flex.items-center svg.w-5.h-5 + svg.absolute') ? 'Sin cargo' : 'Con cargo') : ''
        };
        
        console.log('Sharing opportunity:', opportunity, 'via platform:', platform);
        
        // Use the SharingModule if available, otherwise fall back to basic sharing
        if (window.SharingModule) {
            window.SharingModule.shareOpportunity(opportunity, platform);
        } else {
            // Legacy fallback
            switch (platform) {
                case 'copy':
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        Utils.showAlert('URL copiada al portapapeles');
                    }).catch(err => {
                        console.error('Error copying URL:', err);
                        Utils.showAlert('Error al copiar URL', 'error');
                    });
                    break;

                case 'whatsapp':
                    window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + shareUrl)}`, '_blank');
                    break;

                case 'linkedin':
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                    break;

                case 'email':
                    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(title + '\n\n' + shareUrl)}`, '_blank');
                    break;
                    
                default:
                    console.error(`Unsupported sharing platform: ${platform}`);
                    break;
            }
        }
    },

    // After successful save
    refreshSavedOpportunities() {
        const refreshEvent = new CustomEvent('refresh-saved-opportunities');
        document.dispatchEvent(refreshEvent);
    }
}; 