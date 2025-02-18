/**
 * search.js – Basic search functionality
 */

// Add at the beginning with other selectors
const featuredSection = document.querySelector('.featured-opportunities');
const searchInput = document.getElementById('open-search');

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function performSearch(pages, query) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t);
    if (!terms.length) return pages;

    return pages.filter(page => {
        const searchText = normalizeText([
            page.properties.nombre?.join(' ') || '',
            page.properties.og_resumida?.join(' ') || '',
            page.properties.entidad?.join(' ') || '',
            page.properties.categoría?.join(' ') || '',
            page.properties.disciplina?.join(' ') || '',
            page.properties.país?.join(' ') || ''
        ].join(' '));

        return terms.every(term => searchText.includes(normalizeText(term)));
    });
}

// No need for initSearchEnhancements anymore
export function initSearchEnhancements() {
    // Empty function to maintain compatibility
    return;
}

// Modify the existing search input handler
searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    
    // Hide featured section when there's a search term
    if (searchTerm !== '') {
        featuredSection.classList.add('hidden');
    } else {
        featuredSection.classList.remove('hidden');
    }
    
    // Existing search logic continues...
    performSearch();
});

// Add to filter dropdown handler
document.getElementById('apply-filters').addEventListener('click', function() {
    featuredSection.classList.add('hidden');
    // Existing filter logic continues...
});

// Modify clear filters function
document.getElementById('clear-search').addEventListener('click', function() {
    // Existing clear logic...
    featuredSection.classList.remove('hidden');
});

