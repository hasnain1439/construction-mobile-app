import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { LoadState } from '@/features/office';
import { useI18n } from '@/i18n';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';

/** Loading / offline / not allowed / error for an online office page; children once loaded. */
export function OfficeState({ state, onRetry, empty, children }: { state: LoadState; onRetry: () => void; empty?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  if (state === 'loading') {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color={COLORS.primary} />
        <Text className="mt-2 text-sm text-muted">{t('common.loading')}</Text>
      </View>
    );
  }
  if (state === 'offline') return <EmptyState icon="📡" title={t('office.offline')} body={t('office.offlineHint')} action={{ label: t('common.retry'), onPress: onRetry }} />;
  if (state === 'denied') return <EmptyState icon="🔒" title={t('office.denied')} />;
  if (state === 'error') return <EmptyState icon="⚠️" title={t('office.error')} action={{ label: t('common.retry'), onPress: onRetry }} />;
  if (empty) return <EmptyState icon="📭" title={t('office.empty')} />;
  return <>{children}</>;
}

/** Search box for the office lists. */
export function OfficeSearch({ value, onChange, placeholder, testID }: { value: string; onChange: (v: string) => void; placeholder: string; testID?: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
      <Icon name="magnify" size={18} color={COLORS.muted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.neutral}
        autoCorrect={false}
        className="flex-1 py-3 text-base text-ink"
      />
    </View>
  );
}

/** A card: title line with an optional right value, then label · value pairs. */
export function OfficeCard({ title, subtitle, right, lines, onPress, testID }: { title: string; subtitle?: string | null; right?: ReactNode; lines?: [string, ReactNode][]; onPress?: () => void; testID?: string }) {
  const body = (
    <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="font-semibold text-base text-ink" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm text-muted" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {lines?.length ? (
        <View className="gap-1">
          {lines.map(([label, value]) => (
            <View key={label} className="flex-row items-center justify-between gap-3">
              <Text className="text-sm text-muted">{label}</Text>
              {typeof value === 'string' || typeof value === 'number' ? <Text className="text-sm font-medium text-ink">{value}</Text> : value}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    <View testID={testID}>{body}</View>
  );
}

/** Tap-to-call button for a phone number. */
export function CallButton({ phone }: { phone: string | null | undefined }) {
  if (!phone) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={phone} hitSlop={8} onPress={() => void Linking.openURL(`tel:${phone}`)} className="rounded-full bg-primary/10 p-2">
      <Icon name="phone" size={18} color={COLORS.primary} />
    </Pressable>
  );
}
