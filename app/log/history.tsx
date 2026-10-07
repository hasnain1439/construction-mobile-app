import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { dailyLogs } from '@/features/queries';
import { useT, type TKey } from '@/i18n';
import { longDate } from '@/lib/dates';

/** Logs of this site from the last 30 days (only today's can be changed). */
export default function LogHistoryScreen() {
  const t = useT();
  const { projectId } = useProject();
  const logs = useQuery((db) => (projectId ? dailyLogs(db, projectId) : []), [projectId]);
  return (
    <Screen header={<Header back title={t('mazeed.myLogs')} />} scroll={false}>
      <FlashList
        data={logs}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState icon="📝" title={t('common.empty')} />}
        renderItem={({ item: l }) => (
          <View className="mb-2 gap-1 rounded-card border border-border bg-card p-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-ink">{longDate(l.logDate)}</Text>
              <Text className="text-xs text-muted">{l.authorName}</Text>
            </View>
            <View className="flex-row flex-wrap gap-1">
              {l.conditions.map((c) => (
                <StatusChip key={c} tone={c === 'NORMAL' ? 'success' : 'warning'} label={t(`cond.${c}` as TKey)} />
              ))}
              {l.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : null}
              {l.lateSync ? <StatusChip label={`📱 ${t('sync.lateSync')}`} /> : null}
            </View>
            {l.workDone ? <Text className="text-sm text-ink">{l.workDone}</Text> : null}
            <Text className="text-xs text-muted">
              📷 {l.photoAttachmentIds.length} · 🎙️ {l.voiceAttachmentIds.length}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}
