/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Mono"', '"Roboto Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        // Semantic design tokens (see src/index.css). Prefer these in new code.
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: token('line'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted'), subtle: token('ink-subtle') },
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), ink: token('accent-ink') },
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),

        // Legacy dark palette, retuned to match the tokens so pages that have
        // not been migrated yet still look like the same product.
        navy: {
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99ccff',
          300: '#66b2ff',
          400: '#3399ff',
          500: '#0077b6',
          600: '#26344d',
          700: '#1e293b',
          800: '#121a2a',
          900: '#0b111d',
          950: '#05080f',
        },
        brand: {
          'bg-dark': '#05080f',
          'topbar-dark': '#0b111d',
          'border-dark': '#1e293b',
        },
      },
      borderRadius: {
        token: 'var(--radius)',
      },
      borderWidth: {
        DEFAULT: '1px',  // Default border width changed to 1px
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        enter: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        glow: {
          '0%, 100%': { opacity: '0.55', transform: 'translate(-50%, 0) scale(1)' },
          '50%': { opacity: '0.8', transform: 'translate(-50%, 4%) scale(1.06)' },
        },
      },
      animation: {
        enter: 'enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        glow: 'glow 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
