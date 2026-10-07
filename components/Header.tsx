import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

export function Header({ title, subtitle, back = false, right }: Props) {
  const { rtl } = useI18n();
  return (
    <View className="min-h-14 flex-row items-center gap-2 border-b border-border bg-card px-2">
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-12 w-12 items-center justify-center rounded-full active:bg-bg">
          <Text className="text-2xl text-ink">{rtl ? '→' : '←'}</Text>
        </Pressable>
      ) : (
        <View className="w-2" />
      )}
      <View className="flex-1 py-2">
        <Text accessibilityRole="header" className="font-semibold text-lg text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
