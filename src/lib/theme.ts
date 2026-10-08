import type { ViewStyle } from 'react-native';

/** Raw colour values for places that can't take a className (icons, tab bar, spinners). */
export const COLORS = {
  primary: '#2563EB',
  primarySoft: '#EEF3FF',
  brand: '#0F1E3D',
  brandLight: '#1B2D54',
  brandMuted: '#94A3C4',
  accent: '#F59E0B',
  success: '#059669',
  warning: '#B45309',
  danger: '#DC2626',
  info: '#0891B2',
  violet: '#7C3AED',
  ink: '#0F172A',
  muted: '#64748B',
  neutral: '#94A3B8',
  border: '#E4E8EF',
  bg: '#F3F5F9',
  card: '#FFFFFF',
  white: '#FFFFFF',
} as const;

/** Soft elevation for cards (RN boxShadow works on iOS and Android). */
export const CARD_SHADOW: ViewStyle = { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)' };
export const RAISED_SHADOW: ViewStyle = { boxShadow: '0 6px 20px rgba(15, 30, 61, 0.18)' };
