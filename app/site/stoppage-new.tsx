import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { StepperInput } from '@components/StepperInput';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { checkStoppage, logStoppage, STOPPAGE_ICON, stoppageDates, stoppages } from '@/features/schedule';
import { STOPPAGE_REASONS, type StoppageReason } from '@/features/types';
import { useSave } from '@/features/useSave';
import { errorText, useI18n, type TKey } from '@/i18n';
import { addDays, todayPK } from '@/lib/dates';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

/** "Kaam ruk gaya": reason, the days (from + how many), a photo (not for a holiday), a note (OTHER). */
export default function NewStoppageScreen() {
  const { t, f, language, rtl } = useI18n();
  const save = useSave();
  const { projectId, project } = useProject();
  const today = todayPK();
  const existing = useQuery((db) => (projectId ? stoppages(db, projectId) : []), [projectId]);
  const [reason, setReason] = useState<StoppageReason | null>(null);
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState(1);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  if (!projectId) return null;

  const error = reason ? checkStoppage({ reason, from, days, note, photoIds: photos }, existing, today) : null;
  const dates = stoppageDates(from, days);
  const submit = () => {
    if (!reason || error) return;
    save((db, c) => logStoppage(db, c, { projectId, reason, from, days, note: note.trim() || undefined, photoIds: photos }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('stop.new')} subtitle={project?.name} />} refresh={false} footer={<BigButton testID="save-stoppage" label={t('common.save')} disabled={!reason || !!error} onPress={submit} />}>
      <Text className="font-semibold text-sm text-ink">{t('stop.reason')}</Text>
      <ChoiceChips testIDPrefix="reason" options={STOPPAGE_REASONS.map((r) => ({ id: r, label: t(`stopreason.${r}` as TKey), icon: STOPPAGE_ICON[r] }))} value={reason} onChange={setReason} />

      <View className="gap-3 rounded-card bg-card p-4" style={CARD_SHADOW}>
        <Text className="font-semibold text-sm text-ink">{t('stop.from')}</Text>
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => setFrom(addDays(from, -1))} className="h-12 w-12 items-center justify-center rounded-full bg-bg">
            <Icon name={rtl ? 'chevron-right' : 'chevron-left'} size={24} color={COLORS.primary} />
          </Pressable>
          <Text className="flex-1 text-center font-bold text-base text-ink">{f.longDate(from)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.next')} onPress={() => setFrom(addDays(from, 1))} className="h-12 w-12 items-center justify-center rounded-full bg-bg">
            <Icon name={rtl ? 'chevron-left' : 'chevron-right'} size={24} color={COLORS.primary} />
          </Pressable>
        </View>
        <Text className="font-semibold text-sm text-ink">{t('stop.days')}</Text>
        <StepperInput label={t('stop.days')} value={days} min={1} max={31} onChange={setDays} />
        <Text className="text-sm text-muted">{t('stop.range', { from: f.shortDate(dates[0]), to: f.shortDate(dates[dates.length - 1]), n: days })}</Text>
      </View>

      <TextInput
        testID="stoppage-note"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={reason === 'OTHER' ? t('stop.noteOther') : `${t('common.note')} (${t('common.optional')})`}
        placeholderTextColor={COLORS.neutral}
        className="min-h-14 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
        textAlignVertical="top"
      />
      {reason !== 'HOLIDAY' ? <Text className="text-sm text-muted">{t('stop.photoHint')}</Text> : null}
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} required={reason !== 'HOLIDAY'} />
      {error ? <Text className="text-sm text-danger">{errorText(language, error)}</Text> : null}
    </Screen>
  );
}
