import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { VoiceRecorder } from '@components/VoiceRecorder';
import { useQuery } from '@/db/live';
import { saveDailyLog } from '@/features/actions';
import { useProject } from '@/features/project';
import { myLogOn } from '@/features/queries';
import { useUser } from '@/features/session';
import { SITE_CONDITIONS, type SiteCondition } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT, type TKey } from '@/i18n';
import { longDate, todayPK } from '@/lib/dates';
import { COLORS } from '@/lib/theme';

const ICON: Record<SiteCondition, string> = { NORMAL: '☀️', RAIN: '🌧️', POWER_CUT: '🔌', WATER_SHORTAGE: '🚱', CURING: '💧', LABOUR_SHORT: '👷', MATERIAL_SHORT: '🧱', OTHER: 'dots-horizontal' };

/** Today's daily log: conditions, work done, photos and one voice note. Saving again updates it. */
export default function DailyLogScreen() {
  const t = useT();
  const save = useSave();
  const user = useUser();
  const { projectId, project } = useProject();
  const today = todayPK();
  const mine = useQuery((db) => (projectId ? myLogOn(db, projectId, user.id, today) : null), [projectId, today, user.id]);
  // The local read is synchronous, so today's saved log (if any) prefills the form.
  const [conditions, setConditions] = useState<SiteCondition[]>(() => mine?.conditions ?? []);
  const [workDone, setWorkDone] = useState(() => mine?.workDone ?? '');
  const [note, setNote] = useState(() => mine?.note ?? '');
  const [photos, setPhotos] = useState<string[]>(() => mine?.photoAttachmentIds ?? []);
  const [voice, setVoice] = useState<string | null>(() => mine?.voiceAttachmentIds[0] ?? null);

  if (!projectId) return null;
  const toggle = (c: SiteCondition) => setConditions((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const ok = conditions.length > 0 || workDone.trim().length > 0 || photos.length > 0 || !!voice;

  const submit = () => {
    if (!ok) return;
    save((db, c) => saveDailyLog(db, c, { projectId, conditions, workDone: workDone.trim() || undefined, note: note.trim() || undefined, photoIds: photos, voiceIds: voice ? [voice] : [] }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('mazeed.dailyLog')} subtitle={`${project?.name ?? ''} · ${longDate(today)}`} />} refresh={false} footer={<BigButton testID="save-log" label={t('common.save')} disabled={!ok} onPress={submit} />}>
      {mine?.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : mine ? <StatusChip tone="success" label={`✓ ${t('aaj.logDone')}`} /> : null}
      <Text className="font-semibold text-sm text-ink">{t('log.conditions')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {SITE_CONDITIONS.map((c) => (
          <Pressable key={c} testID={`cond-${c}`} accessibilityRole="checkbox" accessibilityState={{ checked: conditions.includes(c) }} onPress={() => toggle(c)} className={`min-h-12 flex-row items-center gap-1 rounded-full border px-4 ${conditions.includes(c) ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}>
            <Icon name={ICON[c]} size={18} color={conditions.includes(c) ? COLORS.primary : COLORS.muted} />
            <Text className={conditions.includes(c) ? 'font-semibold text-primary' : 'text-ink'}>{t(`cond.${c}` as TKey)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput testID="log-work" value={workDone} onChangeText={setWorkDone} multiline placeholder={t('log.workDone')} placeholderTextColor={COLORS.neutral} className="min-h-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink" textAlignVertical="top" />
      <TextInput value={note} onChangeText={setNote} multiline placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink" textAlignVertical="top" />
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} />
      <Text className="font-semibold text-sm text-ink">
        {t('log.voice')} ({t('common.optional')})
      </Text>
      <VoiceRecorder value={voice} onChange={setVoice} />
    </Screen>
  );
}
