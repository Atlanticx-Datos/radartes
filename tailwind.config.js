// tailwind.config.js
module.exports = {
  content: [
    './templates/**/*.html', // Include all HTML files in the templates folder
    './static/src/**/*.css', // Include your custom CSS files
  ],
  theme: {
    extend: {
      padding: {
        'figma_mobile': '20px',
      },
    },
  },
  plugins: [],
};

