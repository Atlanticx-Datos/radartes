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
        'extra-tight': '0.5rem',
      }
    },
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


