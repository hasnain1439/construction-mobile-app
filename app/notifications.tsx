import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import type { NotificationRow } from '@/features/types';
import { useT } from '@/i18n';
import { dateTime } from '@/lib/dates';

const DOT: Record<string, string> = { CRITICAL: 'bg-danger', WARNING: 'bg-accent', INFO: 'bg-primary' };

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
          <View className={`mb-2 flex-row gap-3 rounded-card border border-border p-3 ${n.read ? 'bg-card' : 'bg-primary-soft'}`}>
            <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[n.severity] ?? 'bg-neutral'}`} />
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-ink">{n.title}</Text>
              <Text className="text-sm text-muted">{n.body}</Text>
              <Text className="text-xs text-neutral">{dateTime(n.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
