import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { COLORS, TOPBAR_SHADOW } from '@/lib/theme';
import { Icon } from './Icon';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

export function Header({ title, subtitle, back = false, right }: Props) {
  const { rtl } = useI18n();
  return (
    <View className="z-10 min-h-16 flex-row items-center gap-2 bg-card px-3" style={TOPBAR_SHADOW}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-bg active:bg-border">
          <Icon name={rtl ? 'arrow-right' : 'arrow-left'} size={22} color={COLORS.ink} />
        </Pressable>
      ) : (
        <View className="w-1" />
      )}
      <View className="flex-1 py-2">
        <Text accessibilityRole="header" className="font-bold text-xl text-ink" numberOfLines={1}>
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
