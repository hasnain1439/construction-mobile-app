/**
 * Design tokens — warm "cabin" palette shared with the web app: sand #B5A18B, sun #FFCF68,
 * stone #E4E0E0, charcoal #201F1E. Charcoal is the primary (buttons, active pills, dark
 * bands); sun highlights the one thing that matters on a screen.
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Light / dark palettes live in src/lib/theme.ts; ThemeProvider sets them as --c-<token> variables.
      colors: {
        primary: { DEFAULT: c('primary'), dark: c('primary-dark'), soft: c('primary-soft') },
        'on-primary': c('on-primary'),
        brand: { DEFAULT: c('brand'), light: c('brand-light'), muted: c('brand-muted') },
        accent: { DEFAULT: c('accent'), dark: c('accent-dark'), soft: c('accent-soft') },
        sand: { DEFAULT: c('sand'), soft: c('sand-soft') },
        stone: c('stone'),
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        violet: { DEFAULT: c('violet'), soft: c('violet-soft') },
        bg: c('bg'),
        card: c('card'),
        border: c('border'),
        ink: c('ink'),
        muted: c('muted'),
        neutral: c('neutral'),
      },
      fontFamily: {
        sans: ['Cabin_400Regular'],
        medium: ['Cabin_500Medium'],
        semibold: ['Cabin_600SemiBold'],
        bold: ['Cabin_700Bold'],
      },
      borderRadius: { card: '20px' },
    },
  },
  plugins: [],
};
