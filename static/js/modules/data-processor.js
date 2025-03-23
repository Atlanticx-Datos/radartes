/**
 * Data processor module for handling raw data from the server
 */

import { DestacarModule } from './destacar.js';

/**
 * Process the raw data for the destacar section
 * @param {Array} rawData - The raw data from the server
 */
export function processDestacarData(rawData) {
    console.log('Processing destacar data:', rawData);
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
        console.warn('No data to process for destacar module');
        return;
    }

    // Look for problematic titles in raw data
    rawData.forEach(page => {
        if (page && page.nombre_original && 
            (page.nombre_original.includes('Cultura Circular') || 
             (page.nombre_original.includes('Convocatoria') && page.nombre_original.includes('|')))) {
            console.log('Found potentially problematic title in raw data:', {
                id: page.id,
                nombre: page.nombre,
                nombre_original: page.nombre_original
            });
            
            // Fix the specific case directly in the raw data
            if (page.nombre_original.includes('Convocatoria') && 
                page.nombre_original.includes('Cultura Circular')) {
                // Create a special field to ensure the title is processed correctly
                page._fixed_title = "Cultura Circular 2025";
                console.log('Added _fixed_title field for Cultura Circular');
            }
        }
    });

    // Process each page to ensure all required fields exist and handle special characters
    const processedData = rawData.map(page => {
        // Create a deep copy to avoid modifying the original data
        const processedPage = JSON.parse(JSON.stringify(page));
        
        // Preserve special fields like _fixed_title if they exist
        if (page._fixed_title) {
            processedPage._fixed_title = page._fixed_title;
        }
        
        // Ensure nombre and nombre_original exist and are strings
        processedPage.nombre = processedPage.nombre || '';
        processedPage.nombre_original = processedPage.nombre_original || processedPage.nombre || '';
        
        // Replace problematic Unicode characters with standard pipe
        // This prevents issues when these characters are included in HTML attributes
        if (processedPage.nombre) {
            processedPage.nombre = processedPage.nombre
                .replace(/\uFE31/g, '|')  // PRESENTATION FORM FOR VERTICAL EM DASH
                .replace(/\u23AE/g, '|')  // INTEGRAL EXTENSION
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
        }
        
        if (processedPage.nombre_original) {
            processedPage.nombre_original = processedPage.nombre_original
                .replace(/\uFE31/g, '|')  // PRESENTATION FORM FOR VERTICAL EM DASH
                .replace(/\u23AE/g, '|')  // INTEGRAL EXTENSION
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
        }
        
        // Find separator in nombre_original if it exists
        const separators = [
            '|',      // VERTICAL LINE
            '\uFE31', // PRESENTATION FORM FOR VERTICAL EM DASH
            '\u23AE', // INTEGRAL EXTENSION
            '\uFF5C', // FULLWIDTH VERTICAL LINE
            '\u2502', // BOX DRAWINGS LIGHT VERTICAL
            '\u2503', // BOX DRAWINGS HEAVY VERTICAL
            '\u250A', // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
            '\u250B'  // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
        ];
        
        // Debug the title field
        if (processedPage.nombre_original) {
            console.log(`Original title for page ${processedPage.id}: "${processedPage.nombre_original}"`);
            
            // Check for both possible separator characters
            const verticalEmDash = '︱'; // U+FE31: PRESENTATION FORM FOR VERTICAL EM DASH
            const integralExtension = '⎮'; // U+23AE: INTEGRAL EXTENSION
            const regularPipe = '|'; // Regular pipe character
            
            // Check which separator is present
            const hasVerticalEmDash = processedPage.nombre_original.includes(verticalEmDash);
            const hasIntegralExtension = processedPage.nombre_original.includes(integralExtension);
            const hasRegularPipe = processedPage.nombre_original.includes(regularPipe);
            
            // Determine which separator to use
            let separator = null;
            if (hasVerticalEmDash) {
                separator = verticalEmDash;
                console.log(`Found vertical em dash separator '︱' in title for page ${processedPage.id}`);
            } else if (hasIntegralExtension) {
                separator = integralExtension;
                console.log(`Found integral extension separator '⎮' in title for page ${processedPage.id}`);
            } else if (hasRegularPipe) {
                separator = regularPipe;
                console.log(`Found regular pipe separator '|' in title for page ${processedPage.id}`);
            }
            
            if (separator) {
                // For debugging, show the character code
                console.log('Separator character code:', separator.charCodeAt(0).toString(16));
                
                // Split the title by the separator
                const parts = processedPage.nombre_original.split(separator);
                console.log('Title parts after split:', parts);
                
                // Store the category and title separately for easier access
                if (parts.length > 1) {
                    processedPage.title_category = parts[0].trim();
                    processedPage.title_name = parts[1].trim();
                    console.log('Extracted category:', processedPage.title_category);
                    console.log('Extracted title:', processedPage.title_name);
                }
            }
            
            // IMPORTANT: Replace the special character with a standard pipe for HTML attributes
            // This prevents syntax errors in onclick attributes
            processedPage.nombre_original = processedPage.nombre_original
                .replace(/\uFE31/g, '|')  // Replace vertical em dash
                .replace(/\u23AE/g, '|');  // Replace integral extension
                
            // Also update the nombre field if it exists
            if (processedPage.nombre) {
                processedPage.nombre = processedPage.nombre
                    .replace(/\uFE31/g, '|')
                    .replace(/\u23AE/g, '|');
            }
        }
        
        // Ensure all required fields exist
        processedPage.id = processedPage.id || '';
        processedPage.nombre = processedPage.nombre || '';
        processedPage.nombre_original = processedPage.nombre_original || processedPage.nombre || '';
        processedPage.url = processedPage.url || '';
        processedPage.país = processedPage.país || processedPage.pais || '';
        processedPage.pais = processedPage.pais || processedPage.país || '';
        processedPage.categoria = processedPage.categoria || '';
        processedPage.disciplina = processedPage.disciplina || '';
        processedPage.fecha_de_cierre = processedPage.fecha_de_cierre || '';
        processedPage.og_resumida = processedPage.og_resumida || '';
        processedPage.requisitos = processedPage.requisitos || '';
        processedPage.inscripcion = processedPage.inscripcion || '';
        
        return processedPage;
    });
    
    console.log('Processed data:', processedData);
    
    // Initialize the DestacarModule with the processed data
    if (window.DestacarModule && typeof window.DestacarModule.init === 'function') {
        window.DestacarModule.init(processedData);
    } else if (DestacarModule && typeof DestacarModule.init === 'function') {
        DestacarModule.init(processedData);
    } else {
        console.error('DestacarModule not found or init method not available');
    }
}

function createDestacarCard(item) {
    const card = document.createElement('div');
    card.className = 'destacar-card';
    
    // Format date for display
    const formattedDate = formatDate(item.fecha_de_cierre);
    
    // Process disciplines for tags
    const disciplines = item.disciplina ? item.disciplina.split(',').map(d => d.trim()).filter(Boolean) : [];
    const mainDiscipline = disciplines.length > 0 ? disciplines[0] : 'General';
    const subDisciplines = disciplines.slice(0, 3); // Limit to 3 subdisciplines
    
    // Determine if paid or free
    const isPaid = item.inscripcion && item.inscripcion.toLowerCase() !== 'sin cargo';
    
    // Create card HTML
    card.innerHTML = `
        <div class="destacar-card-image">
            <img src="${item.image_url || 'static/public/IsoAtx.png'}" alt="${item.nombre || 'Oportunidad destacada'}">
            <div class="destacar-card-badges">
                <span class="destacar-badge destacar-badge-category">${item.categoria || 'Oportunidad'}</span>
                <span class="destacar-badge destacar-badge-discipline">${mainDiscipline}</span>
            </div>
        </div>
        <div class="destacar-card-content">
            <div>
                <h3 class="destacar-card-title">${item.nombre || 'Sin título'}</h3>
                <div class="destacar-card-meta">
                    <div class="destacar-card-country">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 36 41" stroke-width="1.5" stroke="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M18 13.9995C15.7908 13.9995 14 15.7904 14 17.9995C14 20.2086 15.7908 21.9995 18 21.9995C20.2091 21.9995 22 20.2086 22 17.9995C22 15.7904 20.2091 13.9995 18 13.9995ZM9.99996 17.9995C9.99996 13.5812 13.5817 9.99949 18 9.99949C22.4182 9.99949 26 13.5812 26 17.9995C26 22.4178 22.4182 25.9995 18 25.9995C13.5817 25.9995 9.99996 22.4178 9.99996 17.9995Z" fill="currentColor"/>
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M18 4C15.2311 4 12.5244 4.82107 10.2221 6.35938C7.91983 7.89768 6.12541 10.0841 5.06576 12.6423C4.00612 15.2004 3.72883 18.0153 4.26896 20.731C4.8091 23.4467 6.14239 25.9413 8.10026 27.8992L16.5875 36.3845C16.9625 36.7591 17.4709 36.9696 18.001 36.9696C18.5311 36.9696 19.0395 36.7591 19.4145 36.3845L27.8998 27.8992C29.8576 25.9413 31.1909 23.4467 31.7311 20.731C32.2712 18.0153 31.9939 15.2004 30.9343 12.6423C29.8746 10.0841 28.0802 7.89768 25.7779 6.35938C23.4756 4.82107 20.7689 4 18 4ZM30.7283 30.7276C33.2455 28.2102 34.9598 25.0029 35.6542 21.5113C36.3487 18.0196 35.9922 14.4005 34.6297 11.1115C33.2673 7.82247 30.9602 5.01131 28.0002 3.03348C25.0401 1.05566 21.56 0 18 0C14.44 0 10.9599 1.05566 7.99984 3.03348C5.03978 5.01131 2.73267 7.82247 1.37027 11.1115C0.00786066 14.4005 -0.348654 18.0196 0.345805 21.5113C1.04026 25.0029 2.75451 28.2102 5.27176 30.7276L13.76 39.2138C14.885 40.3377 16.4108 40.9696 18.001 40.9696C19.5913 40.9696 21.1165 40.3382 22.2415 39.2143L30.7283 30.7276Z" fill="currentColor"/>
                        </svg>
                        ${item.pais || 'Internacional'}
                    </div>
                    <div class="destacar-card-paid">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="${isPaid ? 
                                'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75h-.75m-6-1.5H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' : 
                                'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'}" />
                        </svg>
                        ${isPaid ? 'Con inscripción' : 'Sin cargo'}
                    </div>
                    <div class="destacar-card-disciplines">
                        ${subDisciplines.map(discipline => 
                            `<span class="destacar-card-discipline-tag">${discipline}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
            <div class="destacar-card-date">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Cierre: ${formattedDate}
            </div>
        </div>
    `;
    
    // Add click event to open the opportunity
    card.addEventListener('click', () => {
        window.open(item.url, '_blank');
    });
    
    return card;
}

function formatDate(dateString) {
    if (!dateString) return 'Sin fecha de cierre';
    
    // TIMEZONE FIX: For YYYY-MM-DD format, parse parts manually to avoid timezone issues
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log('Using timezone-safe parsing for YYYY-MM-DD format in data-processor.js');
        const [year, month, day] = dateString.split('-').map(Number);
        
        // Format using Spanish locale with manual date construction
        // This avoids timezone issues by not using the Date object's getDate method
        const options = { month: 'long' };
        const monthName = new Intl.DateTimeFormat('es-ES', options).format(new Date(year, month - 1, 15)); // Use day 15 to avoid month boundary issues
        
        return `${day} de ${monthName}, ${year}`;
    }
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        // Format: "15 de Enero, 2023"
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('es-ES', options);
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

function initializeNavigation() {
    const container = document.querySelector('.featured-opportunities .grid');
    const prevButton = document.querySelector('.destacar-prev');
    const nextButton = document.querySelector('.destacar-next');
    
    if (!container || !prevButton || !nextButton) return;
    
    // Set initial state
    updateNavigationButtons();
    
    // Add event listeners for navigation buttons
    prevButton.addEventListener('click', () => {
        scrollContainer(-1);
    });
    
    nextButton.addEventListener('click', () => {
        scrollContainer(1);
    });
    
    function scrollContainer(direction) {
        const cardWidth = 416 + 24; // Card width + gap
        container.scrollBy({
            left: cardWidth * direction,
            behavior: 'smooth'
        });
        
        // Update button states after scrolling
        setTimeout(updateNavigationButtons, 300);
    }
    
    function updateNavigationButtons() {
        const scrollLeft = container.scrollLeft;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        
        prevButton.disabled = scrollLeft <= 0;
        nextButton.disabled = scrollLeft >= maxScrollLeft;
        
        prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
        nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    }
    
    // Add scroll event listener to update button states
    container.addEventListener('scroll', updateNavigationButtons);
} 