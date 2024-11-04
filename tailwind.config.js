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
    function({ addUtilities }) {
      const newUtilities = {
        '.text-4xl': {
          fontSize: '2.25rem !important',
          lineHeight: '2.5rem !important',
        },
        '.md\\:text-4xl': {
          fontSize: '2.25rem !important',
          lineHeight: '2.5rem !important',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    }
  ],
}

