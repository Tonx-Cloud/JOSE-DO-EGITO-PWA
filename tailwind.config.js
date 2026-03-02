/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          50: '#F5EED2',
          100: '#F0E6BC',
          200: '#E6D590',
          300: '#DDC464',
          400: '#D4AF37',
          500: '#B8942A',
          600: '#8E7220',
          700: '#645017',
          800: '#3A2E0D',
          900: '#100D04',
        },
        night: {
          DEFAULT: '#020617',
          50: '#0f172a',
          100: '#1e293b',
          200: '#334155',
          300: '#475569',
          400: '#64748b',
          500: '#94a3b8',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        // Tamanhos maiores para 60+
        'base-60': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px base
        'lg-60': ['1.25rem', { lineHeight: '2rem' }],         // 20px
        'xl-60': ['1.5rem', { lineHeight: '2.25rem' }],       // 24px
        '2xl-60': ['1.875rem', { lineHeight: '2.5rem' }],     // 30px
        '3xl-60': ['2.25rem', { lineHeight: '2.75rem' }],     // 36px
        '4xl-60': ['3rem', { lineHeight: '3.5rem' }],         // 48px
      },
      borderRadius: {
        'xl-60': '1.5rem',
        '2xl-60': '2rem',
      },
      spacing: {
        // Espaçamentos maiores para touch targets 60+
        'touch': '3rem',    // 48px mínimo para botões
        'touch-lg': '4rem', // 64px para botões principais
      },
    },
  },
  plugins: [],
};
