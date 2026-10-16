import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { PhotoPicker } from '@components/PhotoPicker';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { getRow } from '@/db/store';
import { checkReceiveLine, equipmentMap, hidesSentQty, receiveEquipment, type ReceiveLine } from '@/features/equipment';
import type { EquipmentTransferRow } from '@/features/types';
import { useSave } from '@/features/useSave';
import { errorText, useI18n } from '@/i18n';
import { qty } from '@/lib/qty';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

type Input = { received: string; damaged: string; note: string; photos: string[] };
const EMPTY: Input = { received: '', damaged: '', note: '', photos: [] };

/**
 * "Saaman mila": count every item that arrived. With blind count the sent quantity is hidden —
 * the munshi writes what he sees; a short count needs a note (the gap becomes a loss on the server).
 */
export default function EquipmentReceiveScreen() {
  const { t, f, language } = useI18n();
  const save = useSave();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useQuery((db) => ({ tr: getRow<EquipmentTransferRow>(db, 'equipment_transfers', id), eq: equipmentMap(db) }), [id]);
  const tr = data.tr;
  const [inputs, setInputs] = useState<Record<string, Input>>({});
  const [note, setNote] = useState('');

  if (!tr) {
    return (
      <Screen header={<Header back title={t('eq.receive')} />} refresh={false}>
        <EmptyState icon="🚚" title={t('err.TRANSFER_NOT_FOUND')} />
      </Screen>
    );
  }
  if (tr.status !== 'ON_THE_WAY') {
    return (
      <Screen header={<Header back title={tr.number} subtitle={t('maal.result')} />}>
        {tr.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('maal.waitingSync')}`} /> : null}
        {tr.items.map((i) => (
          <View key={i.id} className="gap-1 rounded-card bg-card p-4" style={CARD_SHADOW}>
            <Text className="font-semibold text-ink">{data.eq.get(i.equipmentId)?.name ?? '—'}</Text>
            <Text className="text-sm text-muted">
              {t('maal.sent')}: {qty(i.sentQty)} · {t('maal.counted')}: {qty(i.receivedQty)} · {t('maal.damaged')}: {qty(i.damagedQty)}
            </Text>
          </View>
        ))}
      </Screen>
    );
  }

  const blind = hidesSentQty(tr);
  const lines = tr.items.map((i) => {
    const v = inputs[i.id] ?? EMPTY;
    const line: ReceiveLine = { itemId: i.id, received: v.received === '' ? Number.NaN : Number(v.received), damaged: Number(v.damaged || '0'), note: v.note, photoId: v.photos[0] };
    return { item: i, v, line, error: checkReceiveLine(i, line, blind) };
  });
  const ok = lines.every((l) => !l.error);

  const submit = () => {
    if (!ok) return;
    save((db, c) => receiveEquipment(db, c, tr, lines.map((l) => l.line), note.trim() || undefined));
    router.back();
  };

  return (
    <Screen header={<Header back title={`${t('eq.receive')} · ${tr.number}`} subtitle={t('eq.from', { from: tr.from })} />} refresh={false} footer={<BigButton testID="save-eq-receive" label={t('common.save')} disabled={!ok} onPress={submit} />}>
      {blind ? <StatusChip tone="primary" icon="🙈" label={t('maal.blind')} /> : null}
      {lines.map(({ item, v, error }, n) => {
        const e = data.eq.get(item.equipmentId);
        const set = (patch: Partial<Input>) => setInputs((x) => ({ ...x, [item.id]: { ...v, ...patch } }));
        const showErr = error && v.received !== '' && error !== 'VALIDATION_ERROR';
        return (
          <View key={item.id} className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
            <Text className="font-semibold text-base text-ink">
              {e?.name ?? '—'}
              {item.rentalId ? <Text className="font-normal text-sm text-muted">{` · ${t('eq.rentedShort')}`}</Text> : null}
              {!blind && item.sentQty !== undefined && item.sentQty !== null ? <Text className="font-normal text-sm text-muted">{` · ${t('maal.sent')} ${qty(item.sentQty)}`}</Text> : null}
            </Text>
            <QuantityInput testID={`eq-received-${n}`} label={t('maal.counted')} value={v.received} unit={e?.unit} onChange={(received) => set({ received })} />
            <QuantityInput testID={`eq-damaged-${n}`} label={`${t('maal.damaged')} (${t('common.optional')})`} value={v.damaged} unit={e?.unit} onChange={(damaged) => set({ damaged })} />
            <TextInput
              testID={`eq-note-${n}`}
              value={v.note}
              onChangeText={(x) => set({ note: x })}
              placeholder={t('eq.noteHint')}
              placeholderTextColor={COLORS.neutral}
              className={`min-h-12 rounded-xl border bg-card px-3 text-base text-ink ${error === 'NOTE_REQUIRED' ? 'border-warning' : 'border-border'}`}
            />
            {Number(v.damaged || '0') > 0 ? <PhotoPicker kind="SITE_PHOTO" value={v.photos} onChange={(photos) => set({ photos })} max={1} label={t('eq.itemPhoto')} /> : null}
            {showErr ? <Text className="text-sm text-danger">{errorText(language, error)}</Text> : null}
          </View>
        );
      })}
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
      <Text className="text-xs text-muted">{f.dateTime(tr.sentAt)}</Text>
    </Screen>
  );
}
