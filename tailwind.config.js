/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: '#1DB954',
        'spotify-dark': '#191414',
        'spotify-black': '#121212',
        'spotify-light': '#282828',
      }
    },
  },
  plugins: [],
}
