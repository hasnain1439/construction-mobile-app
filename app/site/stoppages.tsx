import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { IconBadge } from '@components/IconBadge';
import { Screen } from '@components/Screen';
import { StatusChip, type Tone } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { useCan } from '@/features/access';
import { useProject } from '@/features/project';
import { STOPPAGE_ICON, stoppages } from '@/features/schedule';
import type { StoppageRow } from '@/features/types';
import { useI18n, type TKey } from '@/i18n';
import { PERM } from '@/lib/permissions';
import { CARD_SHADOW } from '@/lib/theme';

const TONE: Record<StoppageRow['status'], Tone> = { PENDING: 'accent', APPROVED: 'success', REJECTED: 'danger' };

const Gap = () => <View className="h-3" />;

const StoppageItem = memo(function StoppageItem({ s }: { s: StoppageRow }) {
  const { t, f } = useI18n();
  const from = s.dates[0] ?? '';
  const to = s.dates[s.dates.length - 1] ?? from;
  return (
    <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
      <View className="flex-row items-center gap-3">
        <IconBadge name={STOPPAGE_ICON[s.reason]} tone="info" size={40} />
        <View className="flex-1">
          <Text className="font-semibold text-base text-ink">{t(`stopreason.${s.reason}` as TKey)}</Text>
          <Text className="text-sm text-muted">{t('stop.range', { from: f.shortDate(from), to: f.shortDate(to), n: s.dates.length })}</Text>
        </View>
        <StatusChip tone={TONE[s.status]} label={t(`stopstatus.${s.status}` as TKey)} />
      </View>
      {s.note ? <Text className="text-sm text-ink">{s.note}</Text> : null}
      {s.decisionNote ? <Text className="text-sm text-muted">{s.decisionNote}</Text> : null}
      {s.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : null}
    </View>
  );
});

/** Stoppage days of the site (pending + last 60 days) with their approval status. */
export default function StoppagesScreen() {
  const { t } = useI18n();
  const canLog = useCan(PERM.stoppageCreate);
  const { projectId, project } = useProject();
  const list = useQuery((db) => (projectId ? stoppages(db, projectId) : []), [projectId]);
  return (
    <Screen
      header={<Header back title={t('stop.list')} subtitle={project?.name} />}
      scroll={false}
      footer={canLog ? <BigButton testID="new-stoppage" icon="➕" label={t('stop.new')} onPress={() => router.push('/site/stoppage-new')} /> : undefined}
    >
      <FlashList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={<EmptyState icon="🗓️" title={t('stop.empty')} />}
        renderItem={({ item }) => <StoppageItem s={item} />}
      />
    </Screen>
  );
}
