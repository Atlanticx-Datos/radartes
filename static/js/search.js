/**
 * search.js – Handles search input enhancements and autocomplete suggestions
 * 
 * This module adds autocomplete functionality to the search input without
 * modifying the underlying HTMX-based search mechanism.
 */

const fieldWeights = {
    'resumen_generado_por_la_ia': 3,
    'nombre': 2,
    'entidad': 1,
    'og_resumida': 1,
    'categoría': 1,
    'país': 1,
    'disciplina': 2
};

const AUTOCOMPLETE_DATA = {
    disciplines: ['visuales', 'música', 'video', 'escénicas', 'literatura', 'diseño', 'investigación', 'arquitectura'],
    countries: [
        'España', 'Argentina', 'México', 'Colombia', 'EEUU', 'Reino Unido',
        'Italia', 'Francia', 'Alemania', 'Portugal', 'Múltiples países'
    ],
    categories: ['beca', 'premio', 'residencia', 'convocatoria', 'exposición', 'festival']
};

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function calculateScore(page, terms, disciplineGroups) {
    let score = 0;
    
    // Normalize all fields
    const normalizedFields = {};
    for (const field of Object.keys(fieldWeights)) {
        normalizedFields[field] = normalizeText(page.properties[field]?.join(' ') || '');
    }

    terms.forEach(term => {
        const normalizedTerm = normalizeText(term);
        
        // Check discipline groups
        if (disciplineGroups[normalizedTerm]) {
            const pageDisciplines = new Set(
                normalizedFields.disciplina.split(',').map(d => d.trim())
            );
            const matches = disciplineGroups[normalizedTerm]
                .filter(d => pageDisciplines.has(normalizeText(d)));
            score += matches.length * 3;
        }

        // Check field matches
        Object.entries(fieldWeights).forEach(([field, weight]) => {
            const fieldValue = normalizedFields[field];
            if (fieldValue.includes(normalizedTerm)) {
                score += weight;
                if (fieldValue === normalizedTerm) {
                    score += weight; // Exact match bonus
                }
            }
        });
    });

    return score;
}

export function performSearch(pages, query, disciplineGroups) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t);
    if (!terms.length) return pages;

    return pages
        .map(page => ({
            page,
            score: calculateScore(page, terms, disciplineGroups)
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ page }) => page);
}

export function initSearchEnhancements() {
    const searchInput = document.getElementById('open-search');
    if (!searchInput) {
        console.warn('Search input not found');
        return;
    }

    const autocompleteList = document.createElement('div');
    autocompleteList.id = 'autocomplete-list';
    autocompleteList.className = 'absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 hidden';
    searchInput.parentNode.appendChild(autocompleteList);

    searchInput.addEventListener('input', function(e) {
        const query = this.value.trim().toLowerCase();
        autocompleteList.innerHTML = '';
        autocompleteList.classList.remove('active');

        if (query.length < 2) return;

        const suggestions = getSuggestions(query);
        if (suggestions.length > 0) {
            autocompleteList.classList.add('active');
            renderSuggestions(autocompleteList, suggestions, query);
        }
    });

    // Handle suggestion selection
    autocompleteList.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
            const selectedText = suggestionItem.dataset.value;
            searchInput.value = selectedText;
            autocompleteList.classList.remove('active');
            searchInput.focus();
            
            // Trigger the existing search immediately
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
        }
    });

    // Close autocomplete on external click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#autocomplete-list') && !e.target.matches('#open-search')) {
            autocompleteList.classList.remove('active');
        }
    });
}

function getSuggestions(query) {
    const searchData = window.searchAutocompleteData || AUTOCOMPLETE_DATA;
    const normalizedQuery = normalizeText(query);
    const suggestions = [];

    Object.entries(searchData).forEach(([category, items]) => {
        items.forEach(item => {
            if (normalizeText(item).includes(normalizedQuery)) {
                suggestions.push({
                    category: category,
                    value: item,
                    highlighted: highlightMatch(item, query)
                });
            }
        });
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="font-semibold">$1</span>');
}

function renderSuggestions(container, suggestions, query) {
    suggestions.forEach(({ category, value, highlighted }) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
        div.dataset.value = value;
        div.innerHTML = `
            <span class="text-gray-500 text-xs">${category}:</span>
            <span class="ml-2 text-gray-700">${highlighted}</span>
        `;
        container.appendChild(div);
    });
}

