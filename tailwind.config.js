/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        rde: {
          DEFAULT: '#3b82f6',
          soft: '#eff6ff',
          text: '#1d4ed8',
        },
        gdt: {
          DEFAULT: '#f97316',
          soft: '#fff7ed',
          text: '#c2410c',
        },
        ads: {
          DEFAULT: '#9ca3af',
          soft: '#f9fafb',
          text: '#4b5563',
        },
        cdd: {
          DEFAULT: '#22c55e',
          soft: '#f0fdf4',
          text: '#15803d',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        card: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        floating: '0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
