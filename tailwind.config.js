/** @type {import('tailwindcss').Config} */
import { colors } from './src/data/config/colors.js';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        secondary: colors.secondary,
      },
      boxShadow: {
        'glow-primary': `0 0 20px ${colors.primary.glow}`,
        'glow-secondary': `0 0 20px ${colors.secondary.glow}`,
      },
    },
  },
  plugins: [],
};
