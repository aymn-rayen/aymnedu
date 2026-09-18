/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#edfdf6',
          100: '#d3f9e7',
          200: '#aaf1d1',
          300: '#72e4b5',
          400: '#37ce93',
          500: '#10b981',
          600: '#069166',
          700: '#057353',
          800: '#065b43',
          900: '#054b38',
        },
        dark: {
          50: '#f0f4ff',
          100: '#e1e8ff',
          200: '#c3d0ff',
          300: '#94abff',
          400: '#6080ff',
          500: '#3d5afb',
          600: '#2a3af0',
          700: '#2330d8',
          800: '#1f29af',
          900: '#1d278c',
          950: '#131a2e',
          bg: '#0b0f19',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
