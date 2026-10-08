import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { Icon } from './Icon';
import { IconBadge, type BadgeTone } from './IconBadge';

interface Props {
  title: string;
  subtitle?: string | null;
  /** Custom leading element; or pass `icon` for the standard tinted badge. */
  left?: ReactNode;
  icon?: string;
  iconTone?: BadgeTone;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function ListItem({ title, subtitle, left, icon, iconTone, right, onPress, testID }: Props) {
  const body = (
    <>
      {left ?? (icon ? <IconBadge name={icon} tone={iconTone} /> : null)}
      <View className="flex-1">
        <Text className="font-semibold text-base text-ink" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={22} color={COLORS.neutral} /> : null)}
    </>
  );
  const cls = 'min-h-16 flex-row items-center gap-3 rounded-card bg-card px-4 py-3';
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className={`${cls} active:bg-bg`} style={CARD_SHADOW}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID} className={cls} style={CARD_SHADOW}>
      {body}
    </View>
  );
}
