/**
 * Design tokens. Primary blue matches the web app (docs/design-brief.md); the deep navy
 * "brand" surface and amber accent give the app its construction-industry look.
 */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', dark: '#1D4ED8', soft: '#EEF3FF' },
        brand: { DEFAULT: '#0F1E3D', light: '#1B2D54', muted: '#94A3C4' },
        accent: { DEFAULT: '#F59E0B', dark: '#B45309', soft: '#FFF7E6' },
        success: { DEFAULT: '#059669', soft: '#E8F7F1' },
        warning: { DEFAULT: '#B45309', soft: '#FFF7E6' },
        danger: { DEFAULT: '#DC2626', soft: '#FDECEC' },
        info: { DEFAULT: '#0891B2', soft: '#E6F6FA' },
        violet: { DEFAULT: '#7C3AED', soft: '#F1EBFE' },
        bg: '#F3F5F9',
        card: '#FFFFFF',
        border: '#E4E8EF',
        ink: '#0F172A',
        muted: '#64748B',
        neutral: '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
      },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
};
