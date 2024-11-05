module.exports = {
  content: ['./templates/**/*.html', './static/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Setting Inter as the default sans-serif font
      },
      borderWidth: {
        DEFAULT: '1px', // This sets the default border width to 1px
      },
      lineHeight: {
        'custom': '1.7rem',
      },
      fontSize: {
        '7xl': ['4.5rem', {
          lineHeight: '0.93',
        }],
      },
    },
  },
  screens: {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1336px',
  },
  daisyui: {
    themes: [
      {
        "mytheme": {
          "primary": "#0CC7C7",
          "secondary": "#FFA00F",
          "green" : "#10E07F",
          "accent": "#F05A30",
          "neutral": "#000",
          "base-100": "#ffffff",
        },
      },
    ],
  },
  plugins: [
    require('daisyui'),
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.hero-title': {
          fontSize: '3rem !important',
          lineHeight: '0.93 !important',
          fontWeight: '600 !important', // semibold for mobile
          letterSpacing: '-0.025em !important', // tight tracking for mobile
          textTransform: 'uppercase',
          '@screen md': {
            fontSize: '4.5rem !important',
            lineHeight: '0.93 !important',
            fontWeight: '500 !important', // medium for desktop
            letterSpacing: '0 !important', // normal tracking for desktop
          }
        }
      }
      addUtilities(newUtilities)
    }
  ],
}

