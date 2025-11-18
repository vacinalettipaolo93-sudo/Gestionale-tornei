module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        accent: '#22d3ee',
        'accent-hover': '#67e8f9',
        highlight: '#8b5cf6',
        'text-primary': '#e2e8f0',
        'text-secondary': '#94a3b8'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        subtlePulse: {
          '0%, 100%': { opacity: 0.7 },
          '50%': { opacity: 1 }
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        subtlePulse: 'subtlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
};
