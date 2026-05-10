/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand = navy blue
        brand: {
          50:  '#f0f4fb',
          100: '#dbe4f3',
          200: '#b6c8e6',
          300: '#8aa5d2',
          400: '#5a7cb8',
          500: '#1e3a8a',
          600: '#172e6e',
          700: '#112555',
          800: '#0c1b3f',
          900: '#08132d',
        },
        // Accent = warm orange
        accent: {
          50:  '#fff5ed',
          100: '#ffe6d1',
          200: '#ffc89e',
          300: '#ffa566',
          400: '#ff8333',
          500: '#f97316',
          600: '#ea5a05',
          700: '#c24403',
          800: '#933305',
          900: '#762a08',
        },
        clinical: {
          bg: '#f7fafc',
          surface: '#ffffff',
          border: '#e5e7eb',
          text:   '#0f172a',
          muted:  '#64748b',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
