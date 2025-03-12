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

    // Process each page to ensure all required fields exist and handle special characters
    const processedData = rawData.map(page => {
        // Create a deep copy to avoid modifying the original data
        const processedPage = JSON.parse(JSON.stringify(page));
        
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
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