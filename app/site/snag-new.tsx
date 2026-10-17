import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { Header } from '@components/Header';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { useCan } from '@/features/access';
import { assigneeOptions, checkSnag, createSnag, targetIn } from '@/features/closeout';
import { useProject } from '@/features/project';
import { useSave } from '@/features/useSave';
import { errorText, useI18n } from '@/i18n';
import { PERM } from '@/lib/permissions';
import { COLORS } from '@/lib/theme';

const TARGETS = ['0', '3', '7', '14'] as const;

/** New snag: where, what, before photo(s), fix-by date; who fixes it only for people who may assign. */
export default function NewSnagScreen() {
  const { t, f, language } = useI18n();
  const save = useSave();
  const canAssign = useCan(PERM.snagManage);
  const { projectId, project } = useProject();
  const people = useQuery((db) => (projectId && canAssign ? assigneeOptions(db, projectId) : []), [projectId, canAssign]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [target, setTarget] = useState<(typeof TARGETS)[number]>('0');
  const [assignee, setAssignee] = useState('NONE');
  if (!projectId) return null;
  const error = checkSnag({ location, description, beforePhotoIds: photos });
  const typed = location.trim() || description.trim() || photos.length;

  const submit = () => {
    if (error) return;
    const who = people.find((p) => p.id === assignee) ?? null;
    save((db, c) => createSnag(db, c, { projectId, location, description, beforePhotoIds: photos, targetDate: target === '0' ? null : targetIn(Number(target)), assignee: who }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('snag.new')} subtitle={project?.name} />} refresh={false} footer={<BigButton testID="save-snag" label={t('common.save')} disabled={!!error} onPress={submit} />}>
      <TextInput testID="snag-location" value={location} onChangeText={setLocation} placeholder={t('snag.location')} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
      <TextInput
        testID="snag-description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder={t('snag.description')}
        placeholderTextColor={COLORS.neutral}
        className="min-h-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
        textAlignVertical="top"
      />
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} label={t('snag.before')} required />
      <Text className="font-semibold text-sm text-ink">{t('snag.target')}</Text>
      <ChoiceChips
        testIDPrefix="target"
        options={TARGETS.map((d) => ({ id: d, label: d === '0' ? t('snag.noTarget') : t('snag.inDays', { n: d }) }))}
        value={target}
        onChange={setTarget}
      />
      {target !== '0' ? <Text className="text-sm text-muted">{f.longDate(targetIn(Number(target)))}</Text> : null}
      {canAssign && people.length ? (
        <>
          <Text className="font-semibold text-sm text-ink">{t('snag.assignee')}</Text>
          <ChoiceChips testIDPrefix="assignee" options={[{ id: 'NONE', label: t('snag.nobody') }, ...people.map((p) => ({ id: p.id, label: p.name, icon: p.type === 'WORKER' ? '👷' : '🤝' }))]} value={assignee} onChange={setAssignee} />
        </>
      ) : null}
      {typed && error ? <Text className="text-sm text-danger">{errorText(language, error)}</Text> : null}
    </Screen>
  );
}
