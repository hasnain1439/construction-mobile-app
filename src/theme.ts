import type { ViewStyle } from 'react-native';

/** JS copies of the tailwind tokens (tailwind.config.js) for icons, tab bar and native props. */
export const colors = {
  brand: '#0F2847',
  brandLight: '#1B3A63',
  brandInk: '#CBD8EA',
  primary: '#2563EB',
  primarySoft: '#EAF1FE',
  accent: '#F5A524',
  accentSoft: '#FEF5E4',
  success: '#0F9D6B',
  successSoft: '#E7F7F0',
  warning: '#C2710C',
  warningSoft: '#FDF3E3',
  danger: '#DC2E2E',
  dangerSoft: '#FDECEC',
  violet: '#7C4DDB',
  violetSoft: '#F1ECFC',
  teal: '#0E8F9C',
  tealSoft: '#E4F5F6',
  bg: '#F2F4F8',
  card: '#FFFFFF',
  border: '#E3E8EF',
  ink: '#0F172A',
  muted: '#5B6B82',
  neutral: '#94A3B8',
  white: '#FFFFFF',
} as const;

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'violet' | 'teal' | 'neutral';

/** Foreground + soft background per tone (icon tiles, chips). */
export const tone: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  accent: { fg: colors.warning, bg: colors.accentSoft },
  violet: { fg: colors.violet, bg: colors.violetSoft },
  teal: { fg: colors.teal, bg: colors.tealSoft },
  neutral: { fg: colors.muted, bg: colors.bg },
};

/** Soft card elevation (RN boxShadow works on both platforms with the new architecture). */
export const shadow: ViewStyle = { boxShadow: '0px 1px 2px rgba(15, 23, 42, 0.06), 0px 2px 8px rgba(15, 23, 42, 0.05)' };
export const shadowLg: ViewStyle = { boxShadow: '0px 6px 20px rgba(15, 40, 71, 0.18)' };
