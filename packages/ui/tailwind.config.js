/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // workbench palette — colour encodes meaning, not decoration
        ink: { DEFAULT: '#1E2527', soft: '#3A4447', muted: '#6B7679', faint: '#9AA4A6' },
        panel: { DEFAULT: '#F3F5F4', deep: '#E8ECEA' },
        line: { DEFAULT: '#DDE3E1', strong: '#C6CFCC' },
        and: { DEFAULT: '#1F7A74', soft: '#E3F1EF' }, // AND refinement: sequence, any order, interleaved
        or: { DEFAULT: '#B7791F', soft: '#F7EEDC' }, // OR refinement: alternative, choice, degradation
        task: { DEFAULT: '#56636B', soft: '#ECEFF0' },
        trace: { DEFAULT: '#6D4AFF', soft: '#EEEAFF' }, // selection / trace only
        danger: { DEFAULT: '#C2412D', soft: '#FBEAE7' },
        caution: { DEFAULT: '#9A6B00', soft: '#FFF6D6' },
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
