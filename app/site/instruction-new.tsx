import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { checkInstruction, recordInstruction } from '@/features/closeout';
import { useProject } from '@/features/project';
import { useSave } from '@/features/useSave';
import { useI18n } from '@/i18n';
import { COLORS } from '@/lib/theme';

/** "Hidayat": what the owner asked for on site (photo + note) — the office turns it into a change order. */
export default function NewInstructionScreen() {
  const { t } = useI18n();
  const save = useSave();
  const { projectId, project } = useProject();
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  if (!projectId) return null;
  const error = checkInstruction(note);
  const submit = () => {
    if (error) return;
    save((db, c) => recordInstruction(db, c, { projectId, note, photoIds: photos }));
    router.back();
  };
  return (
    <Screen header={<Header back title={t('si.new')} subtitle={project?.name} />} refresh={false} footer={<BigButton testID="save-instruction" label={t('common.save')} disabled={!!error} onPress={submit} />}>
      <Text className="text-sm text-muted">{t('si.hint')}</Text>
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} />
      <TextInput
        testID="instruction-note"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={t('si.note')}
        placeholderTextColor={COLORS.neutral}
        className="min-h-28 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
        textAlignVertical="top"
      />
    </Screen>
  );
}
