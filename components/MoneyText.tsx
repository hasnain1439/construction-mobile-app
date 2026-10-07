import { Text } from 'react-native';
import { formatPKR, toPaisa } from '@/lib/money';

interface Props {
  paisa: string | number | bigint | null | undefined;
  className?: string;
  /** Green for money in, red for money out. */
  signed?: boolean;
}

/** Only cash and wages are ever shown in this app (never material rates or contract values). */
export function MoneyText({ paisa, className = '', signed }: Props) {
  const p = toPaisa(paisa);
  const tone = signed ? (p < 0n ? 'text-danger' : 'text-success') : 'text-ink';
  return <Text className={`font-semibold ${tone} ${className}`}>{formatPKR(paisa)}</Text>;
}
