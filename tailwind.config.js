/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Navy blue dark mode palette - custom blue shades (lightest to darkest)
        navy: {
          50: '#e6f2ff',   // Lightest blue (for very light backgrounds)
          100: '#cce5ff',  // Very light blue
          200: '#99ccff',  // Light blue
          300: '#66b2ff',  // Medium-light blue
          400: '#3399ff',  // Medium blue
          500: '#0077b6',  // Bright teal blue (brightest of custom colors)
          600: '#0f518e',  // Dusk blue
          700: '#1a3c5b',  // Yale blue
          800: '#102a43',  // Deep space blue (moved from 900)
          900: '#0e1c2f',  // New dark background - primary dark background
          950: '#051627',  // Prussian blue - darkest sections/cards
        },
        // Design system colors
        brand: {
          'bg-dark': '#031220',      // Main background color for dashboard pages (dark mode)
          'topbar-dark': '#0F1C2D',  // Top bar background (dark mode)
          'border-dark': '#1C3245',  // Border color for blocks (dark mode)
        },
      },
      borderWidth: {
        DEFAULT: '1px',  // Default border width changed to 1px
      },
    },
  },
  plugins: [],
};
