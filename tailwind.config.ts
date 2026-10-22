import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  // nomes de classes montados dinamicamente (cores dos membros/categorias)
  safelist: [
    { pattern: /(bg|text|border|ring)-(rose|sky|emerald|amber|violet|slate|teal|orange|indigo|pink|lime|cyan)-(100|500|600|700)/ },
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f3',
          100: '#ffe0e5',
          500: '#e8475f',
          600: '#d12d48',
          700: '#ae2139',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
