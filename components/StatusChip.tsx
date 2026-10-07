import { Text, View } from 'react-native';

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

export function StatusChip({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: string }) {
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${BOX[tone]}`}>
      {icon ? <Text className="text-xs">{icon}</Text> : null}
      <Text className={`font-medium text-xs ${TEXT[tone]}`}>{label}</Text>
    </View>
  );
}
