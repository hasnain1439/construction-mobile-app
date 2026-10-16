import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { milestoneLabel, stageLabel } from '@/features/labels';
import { isLate } from '@/features/schedule';
import type { MilestoneRow, MilestoneStatus } from '@/features/types';
import { useI18n, type TKey } from '@/i18n';
import { qty } from '@/lib/qty';
import { CARD_SHADOW } from '@/lib/theme';
import { ProgressBar } from './ChoiceChips';
import { StatusChip, type Tone } from './StatusChip';

export const MILESTONE_TONE: Record<MilestoneStatus, Tone> = { PLANNED: 'neutral', IN_PROGRESS: 'primary', CURING: 'accent', DONE: 'success', BLOCKED: 'danger' };

interface Props {
  m: MilestoneRow;
  today: string;
  /** materialId → the company's material name (the quota's own description otherwise). */
  materialName: (materialId: string | null, fallback: string) => string;
  onPress?: (id: string) => void;
  /** How many quota lines to show (all on the detail screen). */
  quotaLines?: number;
}

/** A milestone: name, stage, status, progress and the material quota left — quantities only, never money. */
export const MilestoneCard = memo(function MilestoneCard({ m, today, materialName, onPress, quotaLines = 3 }: Props) {
  const { t, f, language } = useI18n();
  const late = isLate(m, today);
  const quotas = m.quotas.filter((q) => q.plannedQty > 0).slice(0, quotaLines);
  const body = (
    <>
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text className="font-semibold text-base text-ink" numberOfLines={2}>
            {milestoneLabel(language, m)}
          </Text>
          <Text className="text-xs text-muted">{stageLabel(language, m.stageKey, m.stageName)}</Text>
        </View>
        <StatusChip tone={MILESTONE_TONE[m.status]} label={t(`ms.${m.status}` as TKey)} />
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <ProgressBar percent={m.progressPercent} tone={m.status === 'BLOCKED' ? 'danger' : late ? 'warning' : 'success'} />
        </View>
        <Text className="font-bold text-sm text-ink">{`${m.progressPercent}%`}</Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-muted">{t('site.planned', { from: f.shortDate(m.plannedStart), to: f.shortDate(m.plannedEnd) })}</Text>
        {late ? <StatusChip tone="danger" label={t('site.late')} /> : null}
        {m.status === 'CURING' && m.curingUntil ? <StatusChip tone="accent" label={t('site.curingUntil', { date: f.shortDate(m.curingUntil) })} /> : null}
        {m.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : null}
      </View>
      {quotas.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {quotas.map((q) => {
            const name = materialName(q.materialId, q.description);
            const over = q.remainingQty < 0;
            return (
              <StatusChip
                key={`${q.materialId ?? q.material}`}
                tone={over ? 'danger' : q.remainingQty <= q.plannedQty * 0.1 ? 'warning' : 'neutral'}
                label={over ? t('site.quotaOver', { material: name, qty: `${qty(-q.remainingQty)} ${f.unit(q.unit)}` }) : t('site.quotaLeft', { material: name, qty: `${qty(q.remainingQty)} ${f.unit(q.unit)}` })}
              />
            );
          })}
        </View>
      ) : null}
    </>
  );
  const cls = 'gap-2 rounded-card bg-card p-4';
  return onPress ? (
    <Pressable testID={`milestone-${m.key}`} accessibilityRole="button" onPress={() => onPress(m.id)} className={`${cls} active:bg-bg`} style={CARD_SHADOW}>
      {body}
    </Pressable>
  ) : (
    <View testID={`milestone-${m.key}`} className={cls} style={CARD_SHADOW}>
      {body}
    </View>
  );
});
