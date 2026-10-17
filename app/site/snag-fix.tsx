import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { getRow } from '@/db/store';
import { checkFix, fixSnag } from '@/features/closeout';
import type { SnagRow } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useI18n, type TKey } from '@/i18n';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

/** "Theek ho gaya": after photo(s) and what was done; the office checks (verifies) it later. */
export default function FixSnagScreen() {
  const { t } = useI18n();
  const save = useSave();
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useQuery((db) => getRow<SnagRow>(db, 'snags', id), [id]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  if (!s) {
    return (
      <Screen header={<Header back title={t('snag.fix')} />} refresh={false}>
        <EmptyState icon="✅" title={t('err.SNAG_NOT_FOUND')} />
      </Screen>
    );
  }
  const error = checkFix(s, photos);
  const submit = () => {
    if (error) return;
    save((db, c) => fixSnag(db, c, s, { afterPhotoIds: photos, note: note.trim() || undefined }));
    router.back();
  };
  return (
    <Screen header={<Header back title={t('snag.fix')} subtitle={[s.code, s.location].filter(Boolean).join(' · ')} />} refresh={false} footer={<BigButton testID="save-fix" label={t('snag.fix')} disabled={!!error} onPress={submit} />}>
      <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
        <StatusChip tone={s.status === 'OPEN' ? 'danger' : 'success'} label={t(`snagstatus.${s.status}` as TKey)} />
        <Text className="text-base text-ink">{s.description}</Text>
      </View>
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} label={t('snag.after')} required />
      <TextInput
        testID="fix-note"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={`${t('snag.fixNote')} (${t('common.optional')})`}
        placeholderTextColor={COLORS.neutral}
        className="min-h-14 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
        textAlignVertical="top"
      />
    </Screen>
  );
}
