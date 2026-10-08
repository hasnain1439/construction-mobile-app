import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { dailyLogs } from '@/features/queries';
import { useT, type TKey } from '@/i18n';
import { longDate } from '@/lib/dates';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

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
          <View className="mb-3 gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
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
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Icon name="camera-outline" size={14} color={COLORS.muted} />
                <Text className="text-xs text-muted">{l.photoAttachmentIds.length}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon name="microphone-outline" size={14} color={COLORS.muted} />
                <Text className="text-xs text-muted">{l.voiceAttachmentIds.length}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
