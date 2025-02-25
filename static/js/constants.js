// Constants used across modules
export const CONSTANTS = {
    MESSAGES: {
        SAVED: "Oportunidad guardada exitosamente",
        DELETED: "Oportunidad eliminada exitosamente",
        ERROR: "Ha ocurrido un error. Por favor, inténtalo de nuevo."
    },

    // Country aliases to help with search matching
    COUNTRY_ALIASES: {
        'españa': ['spain', 'espana', 'spanish'],
        'estados unidos': ['usa', 'united states', 'eeuu', 'us', 'america'],
        'reino unido': ['uk', 'united kingdom', 'inglaterra', 'england'],
        'francia': ['france', 'french'],
        'alemania': ['germany', 'german'],
        'italia': ['italy', 'italian'],
        'méxico': ['mexico', 'mexican'],
        'brasil': ['brazil', 'brazilian'],
        'argentina': ['argentinian'],
        'colombia': ['colombian'],
        'chile': ['chilean'],
        'perú': ['peru', 'peruvian'],
        'portugal': ['portuguese'],
        'canadá': ['canada', 'canadian']
    },

    DISCIPLINE_GROUPS: {
        'Visuales': new Set([
            'pintura', 'dibujo', 'grabado', 'escultura', 'fotografía', 'arte digital',
            'instalación', 'performance', 'visuales', 'artes visuales', 'arte contemporáneo',
            'arte urbano', 'street art', 'litografía', 'serigrafía', 'textiles',
            'video', 'cine', 'audiovisual', 'documental', 'animación',
            'videojuegos', 'nuevos medios', 'multimedia', 'transmedia'
        ]),
        'Música': new Set([
            'música', 'composición', 'interpretación musical', 'dirección musical',
            'canto', 'ópera', 'jazz', 'música clásica', 'música contemporánea',
            'música experimental', 'sonido', 'arte sonoro'
        ]),
        'Escénicas': new Set([
            'teatro', 'danza', 'circo', 'performance', 'artes vivas',
            'artes escénicas', 'dramaturgia', 'coreografía', 'dirección escénica'
        ]),
        'Literatura': new Set([
            'literatura', 'poesía', 'narrativa', 'ensayo', 'escritura creativa',
            'novela', 'cuento', 'traducción', 'edición'
        ]),
        'Diseño': new Set([
            'diseño', 'diseño gráfico', 'diseño industrial', 'diseño de producto',
            'diseño web', 'diseño digital', 'diseño editorial', 'diseño de moda',
            'diseño textil', 'ilustración', 'tipografía', 'arquitectura', 'urbanismo', 
            'paisajismo', 'diseño de interiores', 'arquitectura efímera', 'diseño espacial'
        ]),
        'Otras': new Set([
            'multidisciplinar', 'investigación', 'beca', 'creación', 'curaduría', 
            'gestión cultural', 'comisariado', 'comisario', 'teoría', 'historia', 
            'mediación cultural', 'mediación', 'patrimonio', 'conservación', 
            'investigación-creación', 'restauración', 'restaurador', 'archivo', 
            'crítica', 'ecología', 'feminismo', 'cultura', 'documentación', 
            'comunidad', 'público', 'audiencia', 'pensamiento', 'medioambiente'
        ])
    },

    MONTH_MAPPING: {
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
    }
}; 