/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,pages,components,services,context}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          950: '#020410', // Deepest Midnight (Background)
          900: '#080C18', // Card Surface Dark
          800: '#0F1526', // Card Surface Light
          700: '#1E293B',
          600: '#334155',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50: '#F8FAFC',
        },
        accent: {
          primary: '#22d3ee',   // Cyan-400 (Neon)
          secondary: '#a78bfa', // Violet-400 (Neon)
          success: '#34d399',   // Emerald-400
          danger: '#fb7185',    // Rose-400
          warning: '#fbbf24',   // Amber-400
          blue: '#3b82f6',      // Royal Blue
          gold: '#fbbf24',      // Amber-400 as gold
        }
      },
      backgroundImage: {
        'main-gradient': 'linear-gradient(to bottom right, #020410, #080C18)',
        'mesh-gradient': 'radial-gradient(circle at 50% -20%, rgba(34, 211, 238, 0.15), transparent 70%), radial-gradient(circle at 100% 50%, rgba(167, 139, 250, 0.15), transparent 50%)',
        'glass-card': 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'glass-border': 'linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)',
        'glow-text': 'linear-gradient(to right, #22d3ee, #a78bfa)',
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(34, 211, 238, 0.3)',
        'glow-purple': '0 0 20px -5px rgba(167, 139, 250, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
