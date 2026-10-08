import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { MaterialLines, parsedLines, type Line } from '@components/MaterialLines';
import { Screen } from '@components/Screen';
import { getDb } from '@/db/client';
import { recordUsage } from '@/features/actions';
import { useProject } from '@/features/project';
import { materialMap, siteLocation, stockOf } from '@/features/queries';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { qty } from '@/lib/qty';
import { COLORS } from '@/lib/theme';

/** "Maal lag gaya" — material used today; stock drops at once. */
export default function UsageScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  if (!projectId) return null;
  const db = getDb();
  const loc = siteLocation(db, projectId);
  const mats = materialMap(db);
  const inStock = (materialId: string) => (loc ? (stockOf(db, loc.id, materialId)?.quantity ?? 0) : 0);
  const items = parsedLines(lines);
  const tooMuch = items.some((i) => i.qty > inStock(i.materialId));

  const submit = () => {
    if (!items.length || tooMuch) return;
    save((d, c) => recordUsage(d, c, { projectId, date: todayPK(), items, note: note.trim() || undefined }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('maal.usage')} />} refresh={false} footer={<BigButton testID="save-usage" label={t('common.save')} disabled={!items.length || tooMuch} onPress={submit} />}>
      <MaterialLines
        value={lines}
        onChange={setLines}
        hint={(id) => t('maal.inStock', { qty: `${qty(inStock(id))} ${mats.get(id)?.unit ?? ''}` })}
        error={(l) => (Number(l.qty) > inStock(l.materialId) ? t('err.INSUFFICIENT_STOCK') : null)}
      />
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
    </Screen>
  );
}
