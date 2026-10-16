import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { MilestoneCard } from '@components/MilestoneCard';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { materialMap } from '@/features/queries';
import { milestones } from '@/features/schedule';
import { useI18n } from '@/i18n';
import { todayPK } from '@/lib/dates';

const Gap = () => <View className="h-3" />;

/** Every milestone of the site (not done + done in the last 14 days), in plan order. */
export default function MilestonesScreen() {
  const { t } = useI18n();
  const { projectId, project } = useProject();
  const today = todayPK();
  const data = useQuery((db) => (projectId ? { list: milestones(db, projectId), mats: materialMap(db) } : null), [projectId]);
  const mats = data?.mats;
  const materialName = useCallback((id: string | null, fallback: string) => (id ? (mats?.get(id)?.name ?? fallback) : fallback), [mats]);
  const open = useCallback((id: string) => router.push({ pathname: '/site/milestone', params: { id } }), []);

  return (
    <Screen header={<Header back title={t('site.progress')} subtitle={project?.name} />} scroll={false}>
      <FlashList
        data={data?.list ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={<EmptyState icon="🗓️" title={t('site.noSchedule')} />}
        renderItem={({ item }) => <MilestoneCard m={item} today={today} materialName={materialName} onPress={open} />}
      />
    </Screen>
  );
}
