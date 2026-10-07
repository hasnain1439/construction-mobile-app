import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  title: string;
  subtitle?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function ListItem({ title, subtitle, left, right, onPress, testID }: Props) {
  const body = (
    <>
      {left}
      <View className="flex-1">
        <Text className="font-medium text-base text-ink" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );
  const cls = 'min-h-14 flex-row items-center gap-3 rounded-card border border-border bg-card px-4 py-3';
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className={`${cls} active:bg-bg`}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID} className={cls}>
      {body}
    </View>
  );
}
