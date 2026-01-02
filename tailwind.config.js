/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Navy blue dark mode palette - darker shades
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#1e293b',  // Darker
          800: '#0f172a',  // Much darker
          900: '#020617',  // Almost black - primary dark background
          950: '#000000',  // Pure black - darker sections/cards
        },
      },
    },
  },
  plugins: [],
};
