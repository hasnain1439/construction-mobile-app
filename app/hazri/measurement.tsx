import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BottomSheet } from '@components/BottomSheet';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { PhotoPicker } from '@components/PhotoPicker';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { recordMeasurement } from '@/features/actions';
import { useProject } from '@/features/project';
import { assignments } from '@/features/queries';
import type { AssignmentRow } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { todayPK } from '@/lib/dates';

/** Sub-contract work measured on site — quantity only; the office values it (no rates here). */
export default function MeasurementScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const subs = useQuery((db) => (projectId ? assignments(db, projectId) : []), [projectId]);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [picking, setPicking] = useState(false);
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  if (!projectId) return null;

  const quantity = Number(qty);
  const ok = !!assignment && description.trim().length >= 2 && quantity > 0;
  const submit = () => {
    if (!ok || !assignment) return;
    save((db, c) => recordMeasurement(db, c, { projectId, assignmentId: assignment.id, date: todayPK(), description: description.trim(), quantity, unit: assignment.unit, attachmentIds: photos }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('hazri.measurement')} />} refresh={false} footer={<BigButton label={t('common.save')} disabled={!ok} onPress={submit} />}>
      {!subs.length ? <EmptyState icon="📏" title={t('hazri.noSubcontracts')} /> : null}
      <ListItem title={assignment ? assignment.subcontractor.name : t('hazri.assignment')} subtitle={assignment?.scope} right={<Text className="text-xl text-muted">▾</Text>} onPress={() => setPicking(true)} />
      <TextInput value={description} onChangeText={setDescription} placeholder={t('common.description')} placeholderTextColor="#94A3B8" className="min-h-14 rounded-card border border-border bg-card px-4 text-base text-ink" />
      <QuantityInput label={t('common.quantity')} value={qty} onChange={setQty} unit={assignment?.unit} />
      <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={10} />
      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={t('hazri.assignment')}>
        {subs.map((s) => (
          <ListItem
            key={s.id}
            title={s.subcontractor.name}
            subtitle={`${s.scope} · ${s.unit}`}
            onPress={() => {
              setAssignment(s);
              setPicking(false);
            }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
