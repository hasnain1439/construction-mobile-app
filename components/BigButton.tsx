import { ActivityIndicator, Pressable, Text } from 'react-native';
import { COLORS } from '@/lib/theme';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

const BOX: Record<Variant, string> = {
  primary: 'bg-primary active:bg-primary-dark',
  secondary: 'border border-border bg-card active:bg-bg',
  accent: 'bg-accent active:opacity-90',
  danger: 'bg-danger active:opacity-90',
  ghost: 'active:bg-primary-soft',
};
const TEXT: Record<Variant, string> = { primary: 'text-white', secondary: 'text-ink', accent: 'text-brand', danger: 'text-white', ghost: 'text-primary' };
const INK: Record<Variant, string> = { primary: COLORS.white, secondary: COLORS.primary, accent: COLORS.brand, danger: COLORS.white, ghost: COLORS.primary };

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Icon name or emoji id (see Icon). */
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
      className={`${small ? 'min-h-12 px-4' : 'min-h-14 px-5'} flex-row items-center justify-center gap-2 rounded-xl ${BOX[variant]} ${off ? 'opacity-50' : ''}`}
    >
      {loading ? <ActivityIndicator color={INK[variant]} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={INK[variant]} /> : null}
      <Text className={`font-semibold ${small ? 'text-sm' : 'text-base'} ${TEXT[variant]}`}>{label}</Text>
    </Pressable>
  );
}
