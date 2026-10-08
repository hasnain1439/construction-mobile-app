import { Pressable, Text, View } from 'react-native';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { Icon } from './Icon';

interface Props {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  format?: (v: number) => string;
}

/** − value + with 48 dp buttons (overtime hours, counts). */
export function StepperInput({ value, onChange, step = 1, min = 0, max = Number.MAX_SAFE_INTEGER, label, format }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)));
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View className="flex-row items-center gap-2" accessibilityLabel={label}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} −`} onPress={() => set(value - step)} disabled={atMin} className="h-12 w-12 items-center justify-center rounded-full bg-card active:bg-bg" style={CARD_SHADOW}>
        <Icon name="minus" size={22} color={atMin ? COLORS.neutral : COLORS.primary} />
      </Pressable>
      <Text className="min-w-12 text-center font-bold text-lg text-ink">{format ? format(value) : value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} +`} onPress={() => set(value + step)} disabled={atMax} className="h-12 w-12 items-center justify-center rounded-full bg-card active:bg-bg" style={CARD_SHADOW}>
        <Icon name="plus" size={22} color={atMax ? COLORS.neutral : COLORS.primary} />
      </Pressable>
    </View>
  );
}
