import { Pressable, Text, View } from 'react-native';

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
  return (
    <View className="flex-row items-center gap-2" accessibilityLabel={label}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} −`} onPress={() => set(value - step)} disabled={value <= min} className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card active:bg-bg">
        <Text className="text-2xl text-ink">−</Text>
      </Pressable>
      <Text className="min-w-12 text-center font-semibold text-lg text-ink">{format ? format(value) : value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} +`} onPress={() => set(value + step)} disabled={value >= max} className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card active:bg-bg">
        <Text className="text-2xl text-ink">+</Text>
      </Pressable>
    </View>
  );
}
