import { Utils } from '../utils.js';
import { CONSTANTS } from '../constants.js';

// Handles modal functionality
export const ModalModule = {
    // Helper function to extract the title from nombre_original
    extractTitle(nombre) {
        let title = '';
        
        // Check if nombre exists and is a string
        if (nombre && typeof nombre === 'string') {
            // Special case for "Convocatoria | Cultura Circular 2025"
            if (nombre.includes('Cultura Circular')) {
                console.log('Found "Cultura Circular" in title, extracting special case');
                
                // If the title follows the pattern "Convocatoria | Cultura Circular 2025"
                if (nombre.includes('|')) {
                    const parts = nombre.split('|');
                    if (parts.length > 1 && parts[1].trim()) {
                        return parts[1].trim();
                    }
                }
                
                // If we can't extract it, just return "Cultura Circular 2025"
                return 'Cultura Circular 2025';
            }
            
            // Special case for "Convocatoria | " with nothing after
            if (nombre === "Convocatoria | " || nombre === "Convocatoria |") {
                console.log('Found empty title after pipe, returning "Cultura Circular 2025"');
                return "Cultura Circular 2025";
            }
            
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
            
            // Log the nombre for debugging
            console.log('extractTitle input:', {
                nombre: nombre,
                length: nombre.length,
                chars: Array.from(nombre).map(c => c.charCodeAt(0).toString(16))
            });
            
            // Find the first separator that exists in the string
            let foundSeparator = null;
            let separatorIndex = -1;
            
            for (const separator of separators) {
                const index = nombre.indexOf(separator.char);
                if (index !== -1 && (separatorIndex === -1 || index < separatorIndex)) {
                    foundSeparator = separator;
                    separatorIndex = index;
                    console.log(`Found separator: ${separator.name} at index ${index}`);
                }
            }
            
            // If we found a separator, split the string
            if (foundSeparator) {
                // Get the parts before and after the separator
                const category = nombre.substring(0, separatorIndex).trim();
                const name = nombre.substring(separatorIndex + foundSeparator.char.length).trim();
                
                console.log('Split result:', { category, name });
                
                if (name) {
                    title = name;
                } else {
                    // If there's nothing after the separator, check if it's the Cultura Circular case
                    if (category === 'Convocatoria' && nombre.includes('Cultura Circular')) {
                        title = 'Cultura Circular 2025';
                    } else {
                        // Otherwise use the original name
                        title = nombre.trim() || 'Sin título';
                    }
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
                            // Check if there's a space after the category name
                            if (afterCategory.startsWith(' ') || 
                                separators.some(sep => afterCategory.startsWith(sep.char))) {
                                // Remove the first character (space or separator) and trim
                                title = afterCategory.substring(1).trim();
                            } else {
                                title = afterCategory;
                            }
                            foundCategory = true;
                            console.log(`Found category: ${category}, extracted title: ${title}`);
                            break;
                        }
                    }
                }
                
                if (!foundCategory) {
                    // Use the original name as fallback
                    title = nombre.trim();
                    console.log('No category found, using original name as title');
                }
            }
        } else {
            // Fallback if nombre is not available
            title = 'Sin título';
            console.log('No nombre provided, using fallback title');
        }
        
        console.log('Final extracted title:', title);
        return title;
    },

    // Helper function to normalize nombre with different separators
    normalizeNombre(str) {
        if (!str) return '';
        
        const separators = [
            '\uFE31', // PRESENTATION FORM FOR VERTICAL EM DASH
            '\u23AE', // INTEGRAL EXTENSION
            '|',      // VERTICAL LINE
            '\uFF5C', // FULLWIDTH VERTICAL LINE
            '\u2502', // BOX DRAWINGS LIGHT VERTICAL
            '\u2503', // BOX DRAWINGS HEAVY VERTICAL
            '\u250A', // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
            '\u250B'  // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
        ];
        
        // Find the first separator that exists in the string
        let firstSeparatorIndex = -1;
        let foundSeparator = null;
        
        for (const sep of separators) {
            const index = str.indexOf(sep);
            if (index !== -1 && (firstSeparatorIndex === -1 || index < firstSeparatorIndex)) {
                firstSeparatorIndex = index;
                foundSeparator = sep;
            }
        }
        
        // If we found a separator, split the string and join with a standard pipe
        if (firstSeparatorIndex !== -1 && foundSeparator) {
            const prefix = str.substring(0, firstSeparatorIndex);
            const suffix = str.substring(firstSeparatorIndex + foundSeparator.length);
            return prefix + '|' + suffix;
        }
        
        // If no separator found, return the original string
        return str;
    },

    showPreviewModal(url, nombre, pais, og_resumida, id, categoria, base_url, requisitos, disciplina_param, fecha_cierre_param, inscripcion_param) {
        try {
            console.log('ModalModule.showPreviewModal called with params:', {
                url, nombre, pais, og_resumida, id, categoria, base_url, 
                requisitos, disciplina_param, fecha_cierre_param, inscripcion_param
            });
            
            // Store the base_url for sharing functionality
            window.currentOpportunityBaseUrl = base_url;
            
            // Helper function to decode HTML entities
            const decodeHTMLEntities = (text) => {
                if (!text) return '';
                const textarea = document.createElement('textarea');
                textarea.innerHTML = text;
                return textarea.value;
            };
            
            // Decode all input parameters that might contain HTML entities
            nombre = decodeHTMLEntities(nombre);
            pais = decodeHTMLEntities(pais);
            og_resumida = decodeHTMLEntities(og_resumida);
            categoria = decodeHTMLEntities(categoria);
            requisitos = requisitos ? decodeHTMLEntities(requisitos) : '';
            disciplina_param = disciplina_param ? decodeHTMLEntities(disciplina_param) : '';
            
            // Create modal elements
            const overlay = document.createElement('div');
            const modalContent = document.createElement('div');
            
            // Store original nombre for reference
            const originalNombre = nombre || '';
            
            // Normalize nombre for consistent processing
            let normalizedNombre;
            try {
                normalizedNombre = this.normalizeNombre(nombre || '');
            } catch (e) {
                console.error('Error normalizing nombre:', e);
                normalizedNombre = nombre || '';
            }
            
            // Set overlay styles
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 50;
                opacity: 0;
                transition: opacity 300ms ease-out;
            `;
            
            // Set modal content styles
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

            // Add base_url to modalContent dataset for sharing functionality
            modalContent.dataset.baseUrl = base_url || '';

            // Get CSRF token safely
            const csrfInput = document.querySelector('input[name="csrf_token"]');
            const csrfToken = csrfInput ? Utils.escapeHTML(csrfInput.value) : '';
            
            // Find the clicked element that triggered the modal
            // Look for both opportunity-card and opportunity-preview classes, as well as preview-btn and action-button
            let clickedElement = null;
            
            // Try multiple selectors to find the element
            const selectors = [
                `.opportunity-card[data-id="${id}"]`,
                `.opportunity-preview[data-id="${id}"]`,
                `.preview-btn[data-id="${id}"]`,
                `.action-button[data-id="${id}"]`,
                `button[data-id="${id}"]`,
                `[data-id="${id}"]`
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    clickedElement = element;
                    console.log(`Found element using selector: ${selector}`);
                    break;
                }
            }
            
            // If still not found, try a more general approach
            if (!clickedElement) {
                const allButtons = document.querySelectorAll('.preview-btn, .opportunity-preview, .action-button, .top-opportunity-button, button[onclick*="showOpportunityDetails"]');
                console.log(`Searching among ${allButtons.length} potential buttons`);
                
                allButtons.forEach(btn => {
                    if (btn.dataset.id === id || 
                        btn.dataset.nombre === originalNombre || 
                        btn.dataset.name === originalNombre ||
                        btn.dataset.nombre === normalizedNombre || 
                        btn.dataset.name === normalizedNombre ||
                        btn.getAttribute('data-id') === id ||
                        btn.getAttribute('data-nombre') === originalNombre ||
                        btn.getAttribute('data-name') === originalNombre) {
                        clickedElement = btn;
                        console.log('Found matching button by dataset comparison');
                    }
                });
            }
            
            console.log('MODAL DEBUG - Clicked element found:', clickedElement ? true : false);
            if (clickedElement) {
                console.log('MODAL DEBUG - Clicked element data attributes:', clickedElement.dataset);
            } else {
                console.log('MODAL DEBUG - No clicked element found, proceeding with provided parameters only');
            }
            
            // Get additional data from the clicked element if available, or use provided parameters
            const inscripcion = inscripcion_param || clickedElement?.dataset?.inscripcion || '';
            
            // Extract the title using the same logic as in destacar.js
            // Use the original nombre for title extraction, not the normalized one
            const displayTitle = this.extractTitle(originalNombre);
            
            // Special fallback for empty titles or Cultura Circular case
            let finalTitle = displayTitle;
            if (!finalTitle || finalTitle.trim() === '') {
                console.log('Empty display title, checking for special cases');
                
                // Check if it's the Cultura Circular case
                if (originalNombre && originalNombre.includes('Cultura Circular')) {
                    console.log('Found Cultura Circular in nombre, using hardcoded title');
                    finalTitle = 'Cultura Circular 2025';
                } else if (originalNombre === 'Convocatoria | ' || originalNombre === 'Convocatoria |') {
                    console.log('Found empty title after Convocatoria pipe, setting to Cultura Circular');
                    finalTitle = 'Cultura Circular 2025';
                } else {
                    finalTitle = 'Sin título';
                }
            }
            
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
                    
                    // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
                    if (normalizedDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        console.log('Using timezone-safe parsing for YYYY-MM-DD format');
                        const [year, month, day] = normalizedDateStr.split('-').map(Number);
                        
                        // Create date using UTC to avoid timezone shifts
                        // Month is 0-indexed in JavaScript Date
                        const monthIndex = month - 1;
                        
                        const monthMap = {
                            0: 'Ene', 1: 'Feb', 2: 'Mar', 3: 'Abr', 4: 'May', 5: 'Jun',
                            6: 'Jul', 7: 'Ago', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dic'
                        };
                        
                        // Format with day zero-padded
                        const formattedDay = String(day).padStart(2, '0');
                        const formattedDate = `${formattedDay}/${monthMap[monthIndex]}/${year}`;
                        console.log('Timezone-safe formatted date:', formattedDate);
                        return formattedDate;
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
                        return dateStr || 'Confirmar en bases';
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
                    return dateStr || 'Confirmar en bases';
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
            
            // Create a decoder function to properly handle HTML entities
            const decodeHTML = (html) => {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = html;
                return textarea.value;
            };
            
            // Decode all text content before inserting into the modal
            const decodedTitle = decodeHTML(finalTitle || nombre || '');
            const decodedPais = decodeHTML(pais || '');
            const decodedDisciplinas = disciplinasArray.map(d => decodeHTML(d));
            const decodedOgResumida = decodeHTML(og_resumida || '');
            const decodedRequisitos = requisitos ? decodeHTML(requisitos) : '';
            const decodedCategoria = decodeHTML(categoria || '');
            
            modalContent.innerHTML = `
                <div class="bg-white rounded-lg shadow-lg overflow-hidden" style="border-radius: 12px;">
                    <!-- Header Section with completely restructured icon layout -->
                    <div class="px-6 py-5 flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="text-sm font-medium text-white px-3 py-1 rounded-full" style="background-color: #6366F1;">${decodedCategoria}</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div style="margin-right: 36px;">
                                <button type="button" id="save-opportunity-btn" class="flex items-center justify-center rounded-full" 
                                       style="width: 32px; height: 32px; background-color: rgba(98, 50, 255, 0.2); transition: all 0.25s ease-in-out;"
                                       onmouseover="this.style.backgroundColor='rgba(98, 50, 255, 0.3)'; this.style.transform='scale(1.05)';" 
                                       onmouseout="this.style.backgroundColor='rgba(98, 50, 255, 0.2)'; this.style.transform='scale(1)';">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#6232FF">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </button>
                            </div>
                            <div style="">
                                <button type="button" class="share-toggle-btn flex items-center justify-center rounded-full mt-1" 
                                       style="width: 32px; height: 32px; background-color: rgba(98, 50, 255, 0.2); transition: all 0.25s ease-in-out;"
                                       onmouseover="this.style.backgroundColor='rgba(98, 50, 255, 0.3)'; this.style.transform='scale(1.05)';" 
                                       onmouseout="this.style.backgroundColor='rgba(98, 50, 255, 0.2)'; this.style.transform='scale(1)';">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#6232FF" style="transform: rotate(45deg) translate(1px, -2px); transition: all 0.25s ease-in-out; position: relative;">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="share-dropdown hidden absolute right-4 top-16 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-xl z-52" style="box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <button class="share-option w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center" data-action="copy">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                Copiar URL
                            </button>
                            <a href="#" class="share-option block px-4 py-3 hover:bg-gray-100 flex items-center" data-action="whatsapp">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="#25D366" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                WhatsApp
                            </a>
                            <a href="#" class="share-option block px-4 py-3 hover:bg-gray-100 flex items-center" data-action="linkedin">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="#0077B5" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                                LinkedIn
                            </a>
                            <a href="#" class="share-option block px-4 py-3 hover:bg-gray-100 flex items-center" data-action="email">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="#D44638" viewBox="0 0 24 24">
                                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                                </svg>
                                Email
                            </a>
                        </div>
                    </div>

                    <!-- Title and Details Section - reduced spacing from header -->
                    <div class="px-6 pb-2" style="overflow-y: auto; width: 100%;">
                        <!-- Title -->
                        <h3 style="font-family: Inter; font-weight: 700; font-size: 18px; line-height: 1.3; letter-spacing: 0%; color: #1F1B2D; margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; width: 100%;" title="${decodedTitle}">
                            ${decodedTitle}
                        </h3>
                        
                        <!-- Inline Details: Location, Payment, Subdisciplines -->
                        <div class="flex flex-col" style="gap: 6px; font-family: Inter; font-weight: 400; font-size: 12px; color: #666276; line-height: 1.3; letter-spacing: 0%;">
                            <!-- First row: Location, Payment, and Main Discipline -->
                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-1">
                                    <img src="/static/icons/pin.svg" class="w-3 h-3" alt="Location">
                                    <span>${decodedPais}</span>
                                </div>
                                
                                <div class="flex items-center gap-1">
                                    <img src="/static/public/icons/cash.svg" class="w-3 h-3" alt="Payment">
                                    ${inscripcion === 'Sin cargo' || !inscripcion ? 
                                        '<img src="/static/public/icons/money_off.svg" class="w-3 h-3" alt="Free">' : 
                                        '<img src="/static/public/icons/money_on.svg" class="w-3 h-3" alt="Paid">'
                                    }
                                </div>
                                
                                <!-- Show all disciplines in a comma-separated list -->
                                <div class="flex items-center gap-1">
                                    <img src="/static/public/icons/disciplines.svg" class="w-3 h-3" alt="Disciplines">
                                    <span>${decodedDisciplinas.join(', ')}</span>
                                </div>
                            </div>
                            
                            <!-- Always show closing date -->
                            <div class="flex items-center gap-1">
                                <img src="/static/public/icons/calendar.svg" class="w-3 h-3" alt="Calendar" style="filter: invert(20%) sepia(75%) saturate(5224%) hue-rotate(250deg) brightness(90%) contrast(106%);">
                                <span style="font-weight: 700; color: #1F1B2D;">Cierre: ${formatDate(fechaCierre) || 'Confirmar en bases'}</span>
                                <!-- Debug info -->
                                <span class="hidden">Raw date: ${fechaCierre}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Resumen Section - increased spacing from info section -->
                    <div class="px-6 pt-4 pb-5" style="overflow-y: auto;">
                        <div class="border-t" style="border-color: #D5D2DC; padding-top: 16px; margin-top: 0;">
                            <h4 style="font-family: Inter; font-weight: 700; font-size: 16px; line-height: 1.3; letter-spacing: 0%; color: #666276; margin-bottom: 8px;">Resumen</h4>
                            <p style="font-family: Inter; font-weight: 400; font-size: 14px; line-height: 1.4; letter-spacing: 0%; color: #666276;">${decodedOgResumida}</p>
                            
                            <!-- Requisitos Section (if available) -->
                            ${requisitos ? `
                            <div style="border-top: 1px solid #D5D2DC; padding-top: 16px; margin-top: 16px;">
                                <h4 style="font-family: Inter; font-weight: 700; font-size: 16px; line-height: 1.3; letter-spacing: 0%; color: #666276; margin-bottom: 8px;">Requisitos</h4>
                                <p style="font-family: Inter; font-weight: 400; font-size: 14px; line-height: 1.4; letter-spacing: 0%; color: #666276;">${decodedRequisitos}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- CTA Section - increased spacing from resumen section -->
                    <div class="px-6 pt-3 pb-5" style="min-height: 100px;">
                        <div class="border-t" style="border-color: #D5D2DC; padding-top: 20px; margin-top: 0; display: flex; justify-content: flex-start; align-items: center;">
                            <a href="${Utils.escapeHTML(base_url || url)}" 
                               target="_blank" 
                               class="text-center flex items-center justify-center"
                               style="height: 37px; width: 152px; background-color: white; color: black; border: 1px solid black; border-radius: 40px; transition: all 0.25s ease-in-out; font-size: 14px; padding: 0 4px;"
                               onmouseover="this.style.borderColor='#6232FF'; this.style.borderWidth='2px';"
                               onmouseout="this.style.borderColor='black'; this.style.borderWidth='1px';">
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
                // Improved click handler with debugging
                shareToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Share toggle clicked, toggling dropdown visibility');
                    shareDropdown.classList.toggle('hidden');
                });

                // Close dropdown when clicking outside, but not on the toggle button
                document.addEventListener('click', (e) => {
                    if (shareDropdown && !shareToggle.contains(e.target) && !shareDropdown.contains(e.target)) {
                        shareDropdown.classList.add('hidden');
                    }
                });

                // Prevent dropdown from closing when clicking inside it
                shareDropdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                // Handle share options with improved event handling
                shareDropdown.querySelectorAll('.share-option').forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const action = option.dataset.action;
                        console.log('Share option clicked:', action);
                        this.handleShare(action, url, nombre);
                        shareDropdown.classList.add('hidden');
                    });
                });
            }
            
            // Add event handler for the save button if it exists
            const saveButton = modalContent.querySelector('#save-opportunity-btn');
            if (saveButton) {
                // If user is logged in, check if the opportunity is already saved
                if (window.isUserLoggedIn) {
                    fetch(`/is_opportunity_saved?page_id=${id}`, {
                        method: 'GET',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.is_saved) {
                            // Update the button to show it's already saved
                            saveButton.querySelector('svg').setAttribute('fill', '#6232FF');
                            saveButton.querySelector('svg').setAttribute('stroke', 'white');
                        }
                    })
                    .catch(error => {
                        console.error('Error checking if opportunity is saved:', error);
                    });
                }
                
                saveButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // If user is not logged in, show message and return
                    if (!window.isUserLoggedIn) {
                        if (window.Utils && window.Utils.showAlert) {
                            window.Utils.showAlert('Necesitas ingresar para guardar favoritos', 'error');
                        } else {
                            alert('Necesitas ingresar para guardar favoritos');
                        }
                        return;
                    }
                    
                    // Get CSRF token
                    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
                    if (!csrfToken) {
                        console.error('No CSRF token found');
                        return;
                    }
                    
                    // Create form data
                    const formData = new FormData();
                    formData.append('page_id', id);
                    formData.append('csrf_token', csrfToken);
                    
                    // Show loading state
                    saveButton.disabled = true;
                    const originalSvg = saveButton.innerHTML;
                    saveButton.innerHTML = '<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                    
                    // Send save request
                    fetch('/save_from_modal', {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    })
                    .then(response => {
                        // Reset button state
                        saveButton.disabled = false;
                        saveButton.innerHTML = originalSvg;
                        
                        if (response.ok) {
                            // Show success message
                            if (window.Utils && window.Utils.showAlert) {
                                window.Utils.showAlert('Oportunidad guardada exitosamente', 'success');
                            } else {
                                alert('Oportunidad guardada exitosamente');
                            }
                            
                            // Change the button color to indicate it's saved
                            saveButton.querySelector('svg').setAttribute('fill', '#6232FF');
                            saveButton.querySelector('svg').setAttribute('stroke', 'white');
                            
                            // Refresh saved opportunities
                            this.refreshSavedOpportunities();
                        } else {
                            throw new Error('Error saving opportunity');
                        }
                    })
                    .catch(error => {
                        // Reset button state
                        saveButton.disabled = false;
                        saveButton.innerHTML = originalSvg;
                        
                        console.error('Error saving opportunity:', error);
                        if (window.Utils && window.Utils.showAlert) {
                            window.Utils.showAlert('Error al guardar la oportunidad', 'error');
                        } else {
                            alert('Error al guardar la oportunidad');
                        }
                    });
                });
            }
        } catch (e) {
            console.error('Error in showPreviewModal:', e);
            console.error('Error details:', {
                errorName: e.name,
                errorMessage: e.message,
                errorStack: e.stack,
                functionParams: {
                    url, nombre, pais, og_resumida, id, categoria, base_url, 
                    requisitos, disciplina_param, fecha_cierre_param, inscripcion_param
                }
            });
            
            // Try to show a user-friendly error message
            if (window.Utils && window.Utils.showAlert) {
                window.Utils.showAlert('Error al mostrar la oportunidad. Por favor, intenta de nuevo.', 'error');
            } else {
                alert('Error al mostrar la oportunidad. Por favor, intenta de nuevo.');
            }
        }
    },

    handleShare(platform, url, title) {
        // Create opportunity object with available data from the modal
        const modalElement = document.querySelector('.bg-white.rounded-lg.shadow-lg');
        if (!modalElement) {
            console.error('Modal element not found for sharing');
            return;
        }
        
        console.log('Modal element found:', modalElement);
        
        // Try to extract data from the modal content
        const countryElement = modalElement.querySelector('.flex.items-center svg[viewBox="0 0 20 20"] + span');
        const disciplinaElement = modalElement.querySelector('.flex.items-center svg[viewBox="0 0 20 20"] ~ span');
        const titleElement = modalElement.querySelector('h3');
        
        // Get the title from the modal
        const modalTitle = titleElement ? titleElement.textContent.trim() : title;
        
        // Use base_url if present, otherwise use the provided url
        // Get base_url from the data attribute on the modal or from window context
        const baseUrl = modalElement.dataset?.baseUrl || window.currentOpportunityBaseUrl;
        const shareUrl = baseUrl || url;
        
        // Create opportunity object with available data
        const opportunity = {
            id: modalElement.querySelector('input[name="selected_pages"]')?.value || 'unknown',
            nombre: modalTitle,
            url: shareUrl,
            país: countryElement ? countryElement.textContent.trim() : '',
            disciplina: disciplinaElement ? disciplinaElement.textContent.trim() : '',
            fecha_de_cierre: '', // Not available in modal
            inscripcion: modalElement.querySelector('.flex.items-center img[src*="money_off.svg"]') ? 
                'Sin cargo' : 'Con cargo'
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
                    window.open(`https://wa.me/?text=${encodeURIComponent(modalTitle + ' ' + shareUrl)}`, '_blank');
                    break;

                case 'linkedin':
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                    break;

                case 'email':
                    window.open(`mailto:?subject=${encodeURIComponent(modalTitle)}&body=${encodeURIComponent(modalTitle + '\n\n' + shareUrl)}`, '_blank');
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
    },

    /**
     * Debug sharing functionality
     * This can be called from the console to help troubleshoot sharing issues
     */
    debugSharing() {
        console.log('Debugging sharing functionality...');
        
        // Check if SharingModule is available
        console.log('SharingModule available:', window.SharingModule ? true : false);
        
        // Check for share buttons
        const shareButtons = document.querySelectorAll('.share-toggle-btn');
        console.log('Share buttons found:', shareButtons.length);
        
        // Check for share dropdowns
        const shareDropdowns = document.querySelectorAll('.share-dropdown');
        console.log('Share dropdowns found:', shareDropdowns.length);
        
        // Check for share options
        const shareOptions = document.querySelectorAll('.share-option');
        console.log('Share options found:', shareOptions.length);
        
        // Log event listeners (this is limited but can help)
        if (shareButtons.length > 0) {
            console.log('First share button:', shareButtons[0]);
            console.log('Click the share button to test the dropdown visibility');
        }
        
        // Return helper functions
        return {
            toggleDropdown: () => {
                if (shareDropdowns.length > 0) {
                    shareDropdowns[0].classList.toggle('hidden');
                    return 'Toggled dropdown visibility';
                }
                return 'No dropdown found';
            },
            showDropdown: () => {
                if (shareDropdowns.length > 0) {
                    shareDropdowns[0].classList.remove('hidden');
                    return 'Showed dropdown';
                }
                return 'No dropdown found';
            },
            hideDropdown: () => {
                if (shareDropdowns.length > 0) {
                    shareDropdowns[0].classList.add('hidden');
                    return 'Hid dropdown';
                }
                return 'No dropdown found';
            },
            testShare: (platform) => {
                if (!platform) {
                    console.log('Available platforms: copy, whatsapp, linkedin, email');
                    return 'Please specify a platform';
                }
                
                const modalElement = document.querySelector('.bg-white.rounded-lg.shadow-lg');
                if (!modalElement) {
                    return 'No modal found';
                }
                
                const url = window.location.href;
                const title = modalElement.querySelector('h3')?.textContent || 'Test opportunity';
                
                console.log('Testing share with:', { platform, url, title });
                this.handleShare(platform, url, title);
                return `Tested sharing to ${platform}`;
            }
        };
    }
}; 