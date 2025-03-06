module.exports = {
  purge: ['./templates/**/*.html'],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1287px',
      '2xl': '1336px',
      'small-phone': {'raw': '(max-height: 667px)'},
      'mid-phone': {'raw': '(min-height: 668px) and (max-height: 800px)'},
      'tall-phone': {'raw': '(min-height: 801px) and (max-height: 900px)'},
      'laptop': {'raw': '(min-height: 901px)'},
    },
    borderWidth: {
      DEFAULT: '1px',
      '0': '0',
      '2': '2px',
      '3': '3px',
      '4': '4px',
      '6': '6px',
      '8': '8px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderWidth: {
        DEFAULT: '1px',
      },
      lineHeight: {
        'custom': '1.7rem',
      },
      fontSize: {
        'xs': ['0.8rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.35rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        'hero': ['8.5rem', { lineHeight: '1' }],
        'md': {
          'xs': ['0.6875rem', { lineHeight: '1rem' }],
          'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
          'base': ['0.9375rem', { lineHeight: '1.5rem' }],
          'lg': ['1rem', { lineHeight: '1.75rem' }],
          'xl': ['1.125rem', { lineHeight: '1.75rem' }],
          '2xl': ['1.375rem', { lineHeight: '2rem' }],
          '3xl': ['1.75rem', { lineHeight: '2.25rem' }],
          '4xl': ['2.125rem', { lineHeight: '2.5rem' }],
          '5xl': ['2.875rem', { lineHeight: '1' }],
          '6xl': ['3.625rem', { lineHeight: '1' }],
          '7xl': ['4.375rem', { lineHeight: '1' }],
          'hero': ['8.125rem', { lineHeight: '1' }],
        }
      },
      colors: {
        'categoria-premios': 'rgba(255, 243, 242, 0.6)',
        'categoria-residencias': 'rgba(242, 255, 243, 0.6)',
        'categoria-convocatorias': 'rgba(242, 246, 255, 0.6)',
        'categoria-fondos': 'rgba(255, 253, 242, 0.6)',
        'categoria-oportunidades': 'rgba(247, 242, 255, 0.6)',
        'categoria-apoyos': 'rgba(255, 245, 242, 0.6)',
        'categoria-becas': 'rgba(242, 255, 251, 0.6)',
        'primary': '#0CC7C7',
        'secondary': '#FFA00F',
        'green': '#10E07F',
        'accent': '#F05A30',
        'design': {
          'primary': '#6232FF',
          'accent': '#CEFF1C',
          'visuales': '#E92E4A',
          'musica': '#FF7022',
          'escenicas': '#F3CE3A',
          'literatura': '#2ED0FF',
          'diseno': '#17A398',
          'cine': '#64113F',
          'otros': '#F15BB5',
          'background': '#FAFAFF',
        },
        'design-gray': {
          '100': '#F9F8FA',
          '200': '#F5F3F8',
          '300': '#EFE9F3',
          '400': '#D5D2DC',
          '500': '#BBB7C5',
          '600': '#96A4A4',
          '700': '#666176',
          '800': '#453F56',
          '900': '#1F1B2D',
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-filters'),
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.hero-title': {
          fontSize: '3rem !important',
          lineHeight: '0.93 !important',
          fontWeight: '600 !important',
          letterSpacing: '-0.025em !important',
          textTransform: 'uppercase',
          '@screen md': {
            fontSize: '4.5rem !important',
            lineHeight: '0.93 !important',
            fontWeight: '500 !important',
            letterSpacing: '0 !important',
          }
        }
      }
      addUtilities(newUtilities)
    }
  ],
}

