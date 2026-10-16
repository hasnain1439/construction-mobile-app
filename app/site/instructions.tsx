import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { StatusChip, type Tone } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import { siteInstructions } from '@/features/closeout';
import { useProject } from '@/features/project';
import { useUser } from '@/features/session';
import type { SiteInstructionRow } from '@/features/types';
import { useI18n, type TKey } from '@/i18n';
import { PERM } from '@/lib/permissions';
import { CARD_SHADOW } from '@/lib/theme';

const TONE: Record<SiteInstructionRow['status'], Tone> = { NEW: 'primary', CONVERTED: 'success', DISMISSED: 'neutral' };
const Gap = () => <View className="h-3" />;

const InstructionItem = memo(function InstructionItem({ s }: { s: SiteInstructionRow }) {
  const { t, f } = useI18n();
  return (
    <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-semibold text-sm text-muted">{[s.code, f.dateTime(s.createdAt)].filter(Boolean).join(' · ')}</Text>
        <StatusChip tone={TONE[s.status]} label={t(`sistatus.${s.status}` as TKey)} />
      </View>
      <Text className="text-base text-ink">{s.note}</Text>
      <View className="flex-row flex-wrap gap-2">
        {s.photoIds.length ? <StatusChip icon="📷" label={String(s.photoIds.length)} /> : null}
        {s.changeOrderCode ? <StatusChip tone="success" icon="🧾" label={s.changeOrderCode} /> : null}
        {s.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : null}
      </View>
      {s.status === 'DISMISSED' && s.dismissReason ? <Text className="text-sm text-muted">{t('si.reason', { reason: s.dismissReason })}</Text> : null}
    </View>
  );
});

/** The owner's instructions recorded on this site (own only, unless the person may see all). */
export default function InstructionsScreen() {
  const { t } = useI18n();
  const user = useUser();
  const p = usePermissions();
  const { projectId, project } = useProject();
  const seeAll = p.can(PERM.instructionView);
  const list = useQuery((db) => (projectId ? siteInstructions(db, projectId, user.id, seeAll) : []), [projectId, user.id, seeAll]);
  return (
    <Screen
      header={<Header back title={t('si.title')} subtitle={project?.name} />}
      scroll={false}
      footer={p.can(PERM.instructionCreate) ? <BigButton testID="new-instruction" icon="➕" label={t('si.new')} onPress={() => router.push('/site/instruction-new')} /> : undefined}
    >
      <FlashList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={<EmptyState icon="📝" title={t('si.empty')} body={t('si.hint')} />}
        renderItem={({ item }) => <InstructionItem s={item} />}
      />
    </Screen>
  );
}
