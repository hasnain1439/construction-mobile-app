import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { MaterialLines, parsedLines, type Line } from '@components/MaterialLines';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { ownerDelivery } from '@/features/actions';
import { useProject } from '@/features/project';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { COLORS } from '@/lib/theme';

/** Material the owner sent to the site himself (counted as owner-supplied stock). */
export default function OwnerDeliveryScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const [lines, setLines] = useState<Line[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  if (!projectId) return null;
  const items = parsedLines(lines);

  const submit = () => {
    if (!items.length) return;
    save((db, c) => ownerDelivery(db, c, { projectId, date: todayPK(), items, photoIds: photos, note: note.trim() || undefined }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('maal.ownerDelivery')} />} refresh={false} footer={<BigButton label={t('common.save')} disabled={!items.length} onPress={submit} />}>
      <MaterialLines value={lines} onChange={setLines} />
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} />
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
    </Screen>
  );
}
