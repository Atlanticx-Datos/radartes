const fieldWeights = {
    'resumen_generado_por_la_ia': 3,
    'nombre': 2,
    'entidad': 1,
    'og_resumida': 1,
    'categoría': 1,
    'país': 1,
    'disciplina': 2
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