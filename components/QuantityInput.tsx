import { Text, TextInput, View } from 'react-native';
import { COLORS } from '@/lib/theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  label?: string;
  placeholder?: string;
  error?: string | null;
  /** Rupees (2 decimals) instead of a quantity (3 decimals). */
  money?: boolean;
  testID?: string;
}

/** Keeps only digits and one decimal point. */
export function cleanNumber(text: string, decimals = 3): string {
  const only = text.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = only.split('.');
  if (!rest.length) return whole;
  return `${whole}.${rest.join('').slice(0, decimals)}`;
}

export function QuantityInput({ value, onChange, unit, label, placeholder, error, money, testID }: Props) {
  return (
    <View className="gap-1">
      {label ? <Text className="font-semibold text-sm text-ink">{label}</Text> : null}
      <View className={`min-h-14 flex-row items-center rounded-xl border bg-card px-3 ${error ? 'border-danger' : 'border-border'}`}>
        {money ? <Text className="mr-1 text-lg text-muted">Rs</Text> : null}
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={(t) => onChange(cleanNumber(t, money ? 2 : 3))}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={COLORS.neutral}
          className="flex-1 py-3 font-semibold text-xl text-ink"
        />
        {unit ? <Text className="ml-2 text-base text-muted">{unit}</Text> : null}
      </View>
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
