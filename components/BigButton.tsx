import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

const BOX: Record<Variant, string> = {
  primary: 'bg-primary active:opacity-80',
  secondary: 'border border-border bg-card active:bg-bg',
  accent: 'bg-accent active:opacity-80',
  danger: 'bg-danger active:opacity-80',
  ghost: 'active:bg-bg',
};
const TEXT: Record<Variant, string> = { primary: 'text-white', secondary: 'text-ink', accent: 'text-ink', danger: 'text-white', ghost: 'text-primary' };

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  testID?: string;
}

/** 56 dp tall (48 dp small) — big enough for a thumb with cement on it. */
export function BigButton({ label, onPress, variant = 'primary', icon, disabled, loading, small, testID }: Props) {
  const off = !!disabled || !!loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      className={`${small ? 'min-h-12 px-4' : 'min-h-14 px-5'} flex-row items-center justify-center gap-2 rounded-card ${BOX[variant]} ${off ? 'opacity-50' : ''}`}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#2563EB'} /> : icon ? <Text className="text-xl">{icon}</Text> : null}
      <Text className={`font-semibold ${small ? 'text-base' : 'text-lg'} ${TEXT[variant]}`}>{label}</Text>
    </Pressable>
  );
}
