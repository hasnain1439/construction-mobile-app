/** Same tokens as the web app (docs/design-brief.md). */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', soft: '#EFF6FF' },
        accent: { DEFAULT: '#F59E0B', soft: '#FFFBEB' },
        success: { DEFAULT: '#059669', soft: '#ECFDF5' },
        warning: { DEFAULT: '#D97706', soft: '#FFFBEB' },
        danger: { DEFAULT: '#DC2626', soft: '#FEF2F2' },
        bg: '#F5F6FA',
        card: '#FFFFFF',
        border: '#E2E8F0',
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
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
};
