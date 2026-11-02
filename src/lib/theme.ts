import type { ViewStyle } from 'react-native';

/**
 * The two palettes — the web dashboard's light and dark themes (construction_frontend globals.css).
 * Dark: charcoal page, dark cards, sand as the primary (buttons, active pills) with charcoal text on it.
 * tailwind.config.js reads them as CSS variables (`--c-<name>`), set by ThemeProvider.
 */
export const LIGHT = {
  primary: '#201F1E',
  primaryDark: '#000000',
  primarySoft: '#EFE9E1',
  onPrimary: '#FFFFFF',
  brand: '#201F1E',
  brandLight: '#2C2A28',
  brandMuted: '#CFC4B6',
  accent: '#FFCF68',
  accentDark: '#B7791F',
  accentSoft: '#FFF1CC',
  sand: '#B5A18B',
  sandSoft: '#EFE8DF',
  stone: '#E4E0E0',
  success: '#2F8A57',
  successSoft: '#E6F3EA',
  warning: '#B7791F',
  warningSoft: '#FDF1D8',
  danger: '#C8402E',
  dangerSoft: '#FBE9E5',
  info: '#4A6DB8',
  infoSoft: '#E9EEF8',
  violet: '#8E52A6',
  violetSoft: '#F3EAF6',
  ink: '#201F1E',
  muted: '#77706A',
  neutral: '#A39B93',
  border: '#E2DCD5',
  bg: '#ECE9E5',
  card: '#F8F6F3',
  white: '#FFFFFF',
};
export type Palette = typeof LIGHT;

export const DARK: Palette = {
  primary: '#B5A18B',
  primaryDark: '#9C8873',
  primarySoft: '#2E2B28',
  onPrimary: '#201F1E',
  brand: '#0F0E0E',
  brandLight: '#2C2A28',
  brandMuted: '#CFC4B6',
  accent: '#FFCF68',
  accentDark: '#E0A83E',
  accentSoft: '#3A3020',
  sand: '#B5A18B',
  sandSoft: '#2E2B28',
  stone: '#3A3734',
  success: '#4CB37C',
  successSoft: '#1A2B21',
  warning: '#E0A83E',
  warningSoft: '#33281A',
  danger: '#E5684A',
  dangerSoft: '#34201B',
  info: '#6F8FD6',
  infoSoft: '#22283A',
  violet: '#A877C2',
  violetSoft: '#2C2233',
  ink: '#EDE9E4',
  muted: '#A8A097',
  neutral: '#8F877F',
  border: '#33302D',
  bg: '#161514',
  card: '#201F1E',
  white: '#FFFFFF',
};

export type Scheme = 'light' | 'dark';

/**
 * Raw colour values for places that can't take a className (icons, tab bar, spinners). The current
 * theme's palette: ThemeProvider swaps the values and re-mounts the app, so read them while rendering
 * (never copy them into module-level constants).
 */
export const COLORS: Palette = { ...LIGHT };

export function applyPalette(scheme: Scheme) {
  Object.assign(COLORS, scheme === 'dark' ? DARK : LIGHT);
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const triplet = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** `--c-<token>: r g b` for every colour of the palette (what tailwind's rgb(var(...)) reads). */
export function paletteVariables(scheme: Scheme): Record<string, string> {
  const p = scheme === 'dark' ? DARK : LIGHT;
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [`--c-${kebab(k)}`, triplet(v)]));
}

/** Soft elevation for cards (RN boxShadow works on iOS and Android). */
export const CARD_SHADOW: ViewStyle = { boxShadow: '0 1px 2px rgba(32, 31, 30, 0.05), 0 4px 14px rgba(32, 31, 30, 0.05)' };
export const RAISED_SHADOW: ViewStyle = { boxShadow: '0 8px 22px rgba(32, 31, 30, 0.16)' };
/** Under the top bar (same as the web shell). */
export const TOPBAR_SHADOW: ViewStyle = { boxShadow: '0 4px 16px rgba(32, 31, 30, 0.10)' };
