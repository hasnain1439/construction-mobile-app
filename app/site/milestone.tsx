import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { MilestoneCard } from '@components/MilestoneCard';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { StepperInput } from '@components/StepperInput';
import { useQuery } from '@/db/live';
import { getRow } from '@/db/store';
import { useCan } from '@/features/access';
import { milestoneLabel } from '@/features/labels';
import { materialMap } from '@/features/queries';
import { checkProgress, statusChoices, updateMilestone } from '@/features/schedule';
import type { MilestoneRow, MilestoneStatus } from '@/features/types';
import { useSave } from '@/features/useSave';
import { errorText, useI18n, type TKey } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { PERM } from '@/lib/permissions';
import { qty } from '@/lib/qty';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

type StatusPick = MilestoneStatus | 'SAME';

/** One milestone: quota per material (planned / used / left) and the site progress update. */
export default function MilestoneScreen() {
  const { t, f, language } = useI18n();
  const save = useSave();
  const canEdit = useCan(PERM.progressEdit);
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useQuery((db) => ({ m: getRow<MilestoneRow>(db, 'milestones', id), mats: materialMap(db) }), [id]);
  const m = data.m;
  const [progress, setProgress] = useState<number>(() => m?.progressPercent ?? 0);
  const [status, setStatus] = useState<StatusPick>('SAME');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  if (!m) {
    return (
      <Screen header={<Header back title={t('site.progress')} />} refresh={false}>
        <EmptyState icon="🗓️" title={t('err.MILESTONE_NOT_FOUND')} />
      </Screen>
    );
  }
  const materialName = (mid: string | null, fallback: string) => (mid ? (data.mats.get(mid)?.name ?? fallback) : fallback);
  const input = { progressPercent: progress !== m.progressPercent ? progress : undefined, status: status === 'SAME' ? undefined : status, note, photoIds: photos };
  const check = checkProgress(m, input);
  const choices = statusChoices(m);
  const needsNote = (status === 'SAME' ? check.status : status) === 'BLOCKED';

  const submit = () => {
    if (check.error) return;
    save((db, c) => updateMilestone(db, c, m, { ...input, note: note.trim() || undefined }));
    router.back();
  };

  const footer = canEdit && m.status !== 'DONE' ? <BigButton testID="save-progress" label={t('common.save')} disabled={!!check.error} onPress={submit} /> : undefined;

  return (
    <Screen header={<Header back title={milestoneLabel(language, m)} />} refresh={false} footer={footer}>
      <MilestoneCard m={m} today={todayPK()} materialName={materialName} quotaLines={0} />
      {m.quotas.length ? (
        <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
          <Text className="font-bold text-base text-ink">{t('site.quota')}</Text>
          <View className="flex-row">
            <Text className="flex-1 text-xs text-muted">{t('maal.material')}</Text>
            <Text className="w-20 text-right text-xs text-muted">{t('site.qPlanned')}</Text>
            <Text className="w-20 text-right text-xs text-muted">{t('site.qUsed')}</Text>
            <Text className="w-20 text-right text-xs text-muted">{t('site.qLeft')}</Text>
          </View>
          {m.quotas.map((q) => (
            <View key={`${q.materialId ?? q.material}`} className="flex-row items-center">
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {`${materialName(q.materialId, q.description)} · ${f.unit(q.unit)}`}
              </Text>
              <Text className="w-20 text-right text-sm text-ink">{qty(q.plannedQty)}</Text>
              <Text className="w-20 text-right text-sm text-ink">{qty(q.usedQty)}</Text>
              <Text className={`w-20 text-right font-semibold text-sm ${q.remainingQty < 0 ? 'text-danger' : 'text-success'}`}>{qty(q.remainingQty)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!canEdit ? <Text className="text-sm text-muted">{t('site.cantUpdate')}</Text> : null}
      {canEdit && m.status !== 'DONE' ? (
        <View className="gap-3 rounded-card bg-card p-4" style={CARD_SHADOW}>
          <Text className="font-bold text-base text-ink">{t('site.updateProgress')}</Text>
          <Text className="font-semibold text-sm text-ink">{t('site.progressPct')}</Text>
          <StepperInput label={t('site.progressPct')} value={progress} step={5} min={0} max={100} onChange={setProgress} format={(v) => `${v}%`} />
          <ChoiceChips
            testIDPrefix="pct"
            options={[0, 25, 50, 75, 100].map((p) => ({ id: String(p), label: `${p}%` }))}
            value={String(progress)}
            onChange={(p) => setProgress(Number(p))}
          />
          {choices.length ? (
            <>
              <Text className="font-semibold text-sm text-ink">{t('site.status')}</Text>
              <ChoiceChips<StatusPick>
                testIDPrefix="status"
                options={[{ id: 'SAME', label: t('site.noChange') }, ...choices.map((s) => ({ id: s, label: t(`ms.${s}` as TKey) }))]}
                value={status}
                onChange={setStatus}
              />
            </>
          ) : null}
          <TextInput
            testID="progress-note"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder={needsNote ? t('site.blockedNote') : `${t('common.note')} (${t('common.optional')})`}
            placeholderTextColor={COLORS.neutral}
            className={`min-h-14 rounded-xl border bg-card px-4 py-3 text-base text-ink ${needsNote && !note.trim() ? 'border-warning' : 'border-border'}`}
            textAlignVertical="top"
          />
          <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} />
          {check.error && check.error !== 'NOTHING_CHANGED' ? <Text className="text-sm text-danger">{errorText(language, check.error)}</Text> : null}
          {!check.error && (check.status !== m.status || check.progressPercent !== m.progressPercent) ? (
            <Text className="text-sm text-muted">{`${t(`ms.${check.status}` as TKey)} · ${check.progressPercent}%`}</Text>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
