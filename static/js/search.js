/**
 * search.js – Basic search functionality
 */

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

