/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      breakpoints: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        'mobile': '320px',
        'tablet': '768px',
        'laptop': '1024px',
        'desktop': '1280px',
      },
      spacing: {
        'taskbar-height': '48px',
        'taskbar-height-sm': '56px',
        'win-radius': '12px',
        'win-radius-sm': '8px',
      },
      screens: {
        'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
        'no-touch': { 'raw': '(hover: hover) and (pointer: fine)' },
        'short': { 'raw': '(max-height: 500px)' },
        'tall': { 'raw': '(min-height: 900px)' },
      },
    },
  },
  plugins: [],
}