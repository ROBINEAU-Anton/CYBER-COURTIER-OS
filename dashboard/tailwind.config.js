/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#050505',
          neon: '#00FF41',
          dark: '#0a1a0f',
          glitch: '#ff003c'
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'neon': '0 0 5px theme("colors.cyber.neon"), 0 0 10px theme("colors.cyber.neon")',
        'neon-strong': '0 0 5px theme("colors.cyber.neon"), 0 0 20px theme("colors.cyber.neon"), inset 0 0 10px theme("colors.cyber.dark")',
      },
      animation: {
        'glitch': 'glitch 0.2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '33%': { transform: 'translate(-2px, 1px)' },
          '66%': { transform: 'translate(2px, -1px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' }
        }
      }
    },
  },
  plugins: [],
}
