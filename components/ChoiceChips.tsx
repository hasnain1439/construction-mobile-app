import { Pressable, Text, View } from 'react-native';
import { COLORS } from '@/lib/theme';
import { Icon } from './Icon';

export interface Choice<T extends string> {
  id: T;
  label: string;
  icon?: string;
}

interface Props<T extends string> {
  options: Choice<T>[];
  value: T | null;
  onChange: (id: T) => void;
  testIDPrefix?: string;
}

/** One choice out of a few, as big pill buttons (reason, status, filter). */
export function ChoiceChips<T extends string>({ options, value, onChange, testIDPrefix }: Props<T>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            testID={testIDPrefix ? `${testIDPrefix}-${o.id}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            className={`min-h-12 flex-row items-center gap-1 rounded-full border px-4 ${on ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={on ? COLORS.primary : COLORS.muted} /> : null}
            <Text className={on ? 'font-semibold text-primary' : 'text-ink'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A thin progress bar (0–100). */
export function ProgressBar({ percent, tone = 'success' }: { percent: number; tone?: 'success' | 'warning' | 'danger' | 'primary' }) {
  const bg = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', primary: 'bg-primary' }[tone];
  return (
    <View className="h-2 overflow-hidden rounded-full bg-border">
      <View className={`h-full rounded-full ${bg}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </View>
  );
}
