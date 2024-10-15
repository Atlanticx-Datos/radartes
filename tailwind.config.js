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
      }
    },
  },
  screens: {
    'sm': '640px',
    // => @media (min-width: 640px) { ... }

    'md': '768px',
    // => @media (min-width: 768px) { ... }

    'lg': '1024px',
    // => @media (min-width: 1024px) { ... }

    'xl': '1280px',
    // => @media (min-width: 1280px) { ... }

    '2xl': '1336px',
    // => @media (min-width: 1436px) { ... }
  },
  daisyui: {
    themes: [
      {
        "mytheme": {  // Your custom theme name
          "primary": "#0CC7C7",   // Light blue (main accent)
          "secondary": "#FFA00F",  // Orange (secondary background)
          "green" : "#10E07F", // Green 
          "accent": "#F05A30",    // Red (secondary accent 1)
          "neutral": "#000",   // Adjust if needed (default neutral)
          "base-100": "#ffffff",  // White (base color)
        },
      },
    ],
  },
  plugins: [
    require('daisyui'),
  ],
}


