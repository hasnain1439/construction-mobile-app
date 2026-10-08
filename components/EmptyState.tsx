import { Text, View } from 'react-native';
import { BigButton } from './BigButton';
import { IconBadge } from './IconBadge';

interface Props {
  icon?: string;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = '📭', title, body, action }: Props) {
  return (
    <View className="items-center gap-2 rounded-card border border-dashed border-border bg-card px-6 py-8">
      <IconBadge name={icon} tone="neutral" size={56} />
      <Text className="mt-1 text-center font-semibold text-base text-ink">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted">{body}</Text> : null}
      {action ? <BigButton small variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
