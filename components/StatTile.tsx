import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { Icon } from './Icon';

type Tone = 'danger' | 'warning' | 'success';
const TEXT: Record<Tone, string> = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' };

/** One number with its label (the web dashboard's KPI tile): two to a row, tappable when it leads somewhere. */
export function StatTile({ label, children, icon, tone, onPress, testID }: { label: string; children: ReactNode; icon?: string; tone?: Tone; onPress?: () => void; testID?: string }) {
  const body = (
    <View className="min-h-20 gap-1 rounded-card border border-border bg-card p-3" style={CARD_SHADOW}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-xs text-muted" numberOfLines={2}>
          {label}
        </Text>
        {icon ? <Icon name={icon} size={16} color={COLORS.muted} /> : null}
      </View>
      {typeof children === 'string' || typeof children === 'number' ? <Text className={`text-xl font-semibold ${tone ? TEXT[tone] : 'text-ink'}`}>{children}</Text> : <View>{children}</View>}
    </View>
  );
  return (
    <View className="min-w-[46%] flex-1" testID={testID}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="active:opacity-90">
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}
