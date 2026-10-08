/**
 * Design tokens — warm "cabin" palette shared with the web app: sand #B5A18B, sun #FFCF68,
 * stone #E4E0E0, charcoal #201F1E. Charcoal is the primary (buttons, active pills, dark
 * bands); sun highlights the one thing that matters on a screen.
 */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#201F1E', dark: '#000000', soft: '#EFE9E1' },
        brand: { DEFAULT: '#201F1E', light: '#2C2A28', muted: '#CFC4B6' },
        accent: { DEFAULT: '#FFCF68', dark: '#B7791F', soft: '#FFF1CC' },
        sand: { DEFAULT: '#B5A18B', soft: '#EFE8DF' },
        stone: '#E4E0E0',
        success: { DEFAULT: '#2F8A57', soft: '#E6F3EA' },
        warning: { DEFAULT: '#B7791F', soft: '#FDF1D8' },
        danger: { DEFAULT: '#C8402E', soft: '#FBE9E5' },
        info: { DEFAULT: '#4A6DB8', soft: '#E9EEF8' },
        violet: { DEFAULT: '#8E52A6', soft: '#F3EAF6' },
        bg: '#ECE9E5',
        card: '#F8F6F3',
        border: '#E2DCD5',
        ink: '#201F1E',
        muted: '#77706A',
        neutral: '#A39B93',
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
