import type { ViewStyle } from 'react-native';

/** Raw colour values (same as tailwind.config.js) for places that can't take a className (icons, tab bar, spinners). */
export const COLORS = {
  primary: '#201F1E',
  primarySoft: '#EFE9E1',
  brand: '#201F1E',
  brandLight: '#2C2A28',
  brandMuted: '#CFC4B6',
  accent: '#FFCF68',
  sand: '#B5A18B',
  stone: '#E4E0E0',
  success: '#2F8A57',
  warning: '#B7791F',
  danger: '#C8402E',
  info: '#4A6DB8',
  violet: '#8E52A6',
  ink: '#201F1E',
  muted: '#77706A',
  neutral: '#A39B93',
  border: '#E2DCD5',
  bg: '#ECE9E5',
  card: '#F8F6F3',
  white: '#FFFFFF',
} as const;

/** Soft elevation for cards (RN boxShadow works on iOS and Android). */
export const CARD_SHADOW: ViewStyle = { boxShadow: '0 1px 2px rgba(32, 31, 30, 0.05), 0 4px 14px rgba(32, 31, 30, 0.05)' };
export const RAISED_SHADOW: ViewStyle = { boxShadow: '0 8px 22px rgba(32, 31, 30, 0.16)' };
