/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { fontFamily: { sans: ['Urbanist', 'sans-serif'] }, colors: { calm: '#ECEBE6', support: '#2A2D34', accent: '#2F5BFF' } } },
  plugins: [],
}
