import { View } from 'react-native';
import { COLORS } from '@/lib/theme';
import { Icon } from './Icon';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'info' | 'violet' | 'neutral';

const BOX: Record<BadgeTone, string> = {
  primary: 'bg-primary-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  accent: 'bg-accent-soft',
  info: 'bg-info-soft',
  violet: 'bg-violet-soft',
  neutral: 'bg-bg',
};
/** Icon colour by tone (read while rendering: the theme can change). */
const inkOf = (tone: BadgeTone): string =>
  ({
  primary: COLORS.primary,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  accent: COLORS.warning,
  info: COLORS.info,
  violet: COLORS.violet,
  neutral: COLORS.muted,
})[tone];

/** Icon in a soft tinted rounded square — the leading visual of list rows and tiles. */
export function IconBadge({ name, tone = 'primary', size = 44 }: { name: string; tone?: BadgeTone; size?: number }) {
  return (
    <View className={`items-center justify-center rounded-xl ${BOX[tone]}`} style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.5)} color={inkOf(tone)} />
    </View>
  );
}
