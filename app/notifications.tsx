import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { IconBadge, type BadgeTone } from '@components/IconBadge';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import type { NotificationRow } from '@/features/types';
import { useT } from '@/i18n';
import { dateTime } from '@/lib/dates';
import { CARD_SHADOW } from '@/lib/theme';

const BADGE: Record<string, { icon: string; tone: BadgeTone }> = {
  CRITICAL: { icon: 'alert-circle-outline', tone: 'danger' },
  WARNING: { icon: 'alert-outline', tone: 'accent' },
  INFO: { icon: 'bell-outline', tone: 'primary' },
};

/** The last 30 days of my notifications (read on the phone; marking read happens on the web). */
export default function NotificationsScreen() {
  const t = useT();
  const list = useQuery((db) => listRows<NotificationRow>(db, 'notifications').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);
  return (
    <Screen header={<Header back title={t('mazeed.notifications')} />} scroll={false}>
      <FlashList
        data={list}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState icon="🔔" title={t('common.empty')} />}
        renderItem={({ item: n }) => (
          <View className={`mb-3 flex-row gap-3 rounded-card p-4 ${n.read ? 'bg-card' : 'bg-primary-soft'}`} style={CARD_SHADOW}>
            <IconBadge name={BADGE[n.severity]?.icon ?? 'bell-outline'} tone={BADGE[n.severity]?.tone ?? 'neutral'} size={40} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-semibold text-ink">{n.title}</Text>
                {!n.read ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </View>
              <Text className="text-sm text-muted">{n.body}</Text>
              <Text className="text-xs text-neutral">{dateTime(n.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
