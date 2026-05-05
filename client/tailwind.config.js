/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#c3d1ff',
          300: '#9db2fc',
          400: '#7088f8',
          500: '#4f61f3',
          600: '#3a43e7',
          700: '#3135cc',
          800: '#2a2ea5',
          900: '#1e2063',
          950: '#131540',
        },
        slate: {
          850: '#1a2035',
          950: '#0d1117',
        },
      },
      fontFamily: {
        sans:    ['Sora', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgba(99,102,241,0.25)',
        'glow':     '0 0 24px rgba(99,102,241,0.3), 0 0 48px rgba(99,102,241,0.1)',
        'glow-lg':  '0 0 40px rgba(99,102,241,0.35), 0 0 80px rgba(99,102,241,0.12)',
        'glow-purple': '0 0 24px rgba(139,92,246,0.3)',
        'glow-blue':   '0 0 24px rgba(59,130,246,0.3)',
      },
      backgroundImage: {
        'gradient-cyber':   'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'gradient-glass':   'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%)',
        'gradient-hero':    'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease-in-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99,102,241,0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(99,102,241,0.4)' },
        },
      },
      borderColor: {
        'glow': 'rgba(99,102,241,0.35)',
      },
    },
  },
  plugins: [],
}
