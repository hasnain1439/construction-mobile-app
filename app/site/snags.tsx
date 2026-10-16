import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { StatusChip, type Tone } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import { assigneeName, isOverdue, snags } from '@/features/closeout';
import { useProject } from '@/features/project';
import { SNAG_STATUSES, type SnagRow, type SnagStatus } from '@/features/types';
import { useI18n, type TKey } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { PERM } from '@/lib/permissions';
import { CARD_SHADOW } from '@/lib/theme';

const SNAG_TONE: Record<SnagStatus, Tone> = { OPEN: 'danger', FIXED: 'accent', VERIFIED: 'success' };
const Gap = () => <View className="h-3" />;

type Item = SnagRow & { assignee: string | null };

const SnagItem = memo(function SnagItem({ s, today, onPress }: { s: Item; today: string; onPress?: (id: string) => void }) {
  const { t, f } = useI18n();
  const overdue = isOverdue(s, today);
  const body = (
    <>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-semibold text-sm text-muted" numberOfLines={1}>
          {[s.code, s.location].filter(Boolean).join(' · ')}
        </Text>
        <StatusChip tone={SNAG_TONE[s.status]} label={t(`snagstatus.${s.status}` as TKey)} />
      </View>
      <Text className="text-base text-ink">{s.description}</Text>
      <View className="flex-row flex-wrap gap-2">
        {s.targetDate ? <StatusChip tone={overdue ? 'danger' : 'neutral'} label={overdue ? t('snag.overdue') : t('snag.due', { date: f.shortDate(s.targetDate) })} /> : null}
        {s.assignee ? <StatusChip icon="👷" label={s.assignee} /> : null}
        {s.inDefectPeriod ? <StatusChip tone="warning" label={t('snag.defect')} /> : null}
        <StatusChip icon="📷" label={`${s.beforePhotoIds.length}${s.afterPhotoIds.length ? ` → ${s.afterPhotoIds.length}` : ''}`} />
        {s.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : null}
      </View>
    </>
  );
  const cls = 'gap-2 rounded-card bg-card p-4';
  return onPress ? (
    <Pressable testID={`snag-${s.id}`} accessibilityRole="button" onPress={() => onPress(s.id)} className={`${cls} active:bg-bg`} style={CARD_SHADOW}>
      {body}
    </Pressable>
  ) : (
    <View className={cls} style={CARD_SHADOW}>
      {body}
    </View>
  );
});

/** Snag list with a status filter; an open snag opens "Theek ho gaya". */
export default function SnagsScreen() {
  const { t } = useI18n();
  const p = usePermissions();
  const { projectId, project } = useProject();
  const [status, setStatus] = useState<SnagStatus | 'ALL'>('OPEN');
  const today = todayPK();
  const list = useQuery((db) => (projectId ? snags(db, projectId, status === 'ALL' ? null : status).map((s) => ({ ...s, assignee: assigneeName(db, s) })) : []), [projectId, status]);
  const canFix = p.can(PERM.snagCreate);
  const open = useCallback((id: string) => router.push({ pathname: '/site/snag-fix', params: { id } }), []);
  return (
    <Screen
      header={<Header back title={t('snag.title')} subtitle={project?.name} />}
      scroll={false}
      footer={canFix ? <BigButton testID="new-snag" icon="➕" label={t('snag.new')} onPress={() => router.push('/site/snag-new')} /> : undefined}
    >
      <FlashList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View className="pb-3">
            <ChoiceChips<SnagStatus | 'ALL'> testIDPrefix="filter" options={[{ id: 'ALL', label: t('common.all') }, ...SNAG_STATUSES.map((s) => ({ id: s, label: t(`snagstatus.${s}` as TKey) }))]} value={status} onChange={setStatus} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="✅" title={t('snag.empty')} />}
        renderItem={({ item }) => <SnagItem s={item} today={today} onPress={canFix && item.status === 'OPEN' ? open : undefined} />}
      />
    </Screen>
  );
}
