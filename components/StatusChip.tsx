import { Text, View } from 'react-native';
import { COLORS } from '@/lib/theme';
import { Icon, splitIcon } from './Icon';

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral' | 'accent';

const BOX: Record<Tone, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  primary: 'bg-primary-soft',
  neutral: 'bg-bg',
  accent: 'bg-accent-soft',
};
const TEXT: Record<Tone, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', primary: 'text-primary', neutral: 'text-muted', accent: 'text-warning' };
const INK: Record<Tone, string> = { success: COLORS.success, warning: COLORS.warning, danger: COLORS.danger, primary: COLORS.primary, neutral: COLORS.muted, accent: COLORS.warning };

export function StatusChip({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: string }) {
  // A label like "⏳ Not synced" shows its emoji as an icon; a bare "✓" becomes a check.
  const split = icon ? { icon, text: label } : label === '✓' ? { icon: '✓', text: '' } : splitIcon(label);
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${BOX[tone]}`}>
      {split.icon ? <Icon name={split.icon} size={14} color={INK[tone]} /> : null}
      {split.text ? <Text className={`font-semibold text-xs ${TEXT[tone]}`}>{split.text}</Text> : null}
    </View>
  );
}
