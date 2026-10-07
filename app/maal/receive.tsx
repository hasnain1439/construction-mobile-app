import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { getRow } from '@/db/store';
import { receiveDispatch, receivePurchase, type CountLine } from '@/features/actions';
import { materialMap } from '@/features/queries';
import type { DispatchRow, PurchaseRow, ReceiveItem } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { qty } from '@/lib/qty';

type Input = { received: string; damaged: string; note: string };

const expected = (i: ReceiveItem) => i.sentQty ?? i.challanQty ?? null;
const counted = (i: ReceiveItem) => i.receivedQty ?? i.countedQty ?? null;

/**
 * Count what arrived. With blind count on, the expected quantities are hidden until the count
 * is saved — the munshi writes what he sees, the result (sent vs counted) comes after sync.
 */
export default function ReceiveScreen() {
  const t = useT();
  const save = useSave();
  const { kind, id } = useLocalSearchParams<{ kind: 'dispatch' | 'purchase'; id: string }>();
  const data = useQuery((db) => ({ row: getRow<DispatchRow | PurchaseRow>(db, kind === 'dispatch' ? 'dispatches' : 'purchases', id), mats: materialMap(db) }), [kind, id]);
  const row = data.row;
  const [inputs, setInputs] = useState<Record<string, Input>>({});
  const [note, setNote] = useState('');

  if (!row) return null;
  const pendingReceipt = row.status === 'ON_THE_WAY' || row.status === 'PENDING_RECEIPT';
  const title = 'number' in row && kind === 'dispatch' ? (row as DispatchRow).number : (row as PurchaseRow).challanNo;

  if (!pendingReceipt) {
    // Result: sent vs counted (shown once the server confirms; blind count reveals it now).
    return (
      <Screen header={<Header back title={title} subtitle={t('maal.result')} />}>
        {row.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('maal.waitingSync')}`} /> : null}
        {row.items.map((i) => {
          const sent = expected(i);
          const got = counted(i);
          const good = got !== null ? got - (i.damagedQty ?? 0) : null;
          const short = sent !== null && good !== null && good < sent;
          return (
            <View key={i.id} className="gap-1 rounded-card border border-border bg-card p-3">
              <Text className="font-semibold text-ink">{data.mats.get(i.materialId)?.name ?? '—'}</Text>
              <Text className="text-sm text-muted">
                {t('maal.sent')}: {qty(sent)} · {t('maal.counted')}: {qty(got)} · {t('maal.damaged')}: {qty(i.damagedQty)}
              </Text>
              {short ? <StatusChip tone="danger" label={t('maal.short', { qty: qty((sent ?? 0) - (good ?? 0)) })} /> : sent !== null ? <StatusChip tone="success" label="✓" /> : null}
            </View>
          );
        })}
      </Screen>
    );
  }

  const lines: (CountLine & { valid: boolean; needsNote: boolean })[] = row.items.map((i) => {
    const v = inputs[i.materialId] ?? { received: '', damaged: '', note: '' };
    const received = Number(v.received || 'NaN');
    const damaged = Number(v.damaged || '0');
    const exp = expected(i);
    // Without blind count the app can ask for a reason when it is short; with blind count the server decides.
    const needsNote = exp !== null && Number.isFinite(received) && received - damaged < exp && !v.note.trim();
    return { materialId: i.materialId, received, damaged, note: v.note.trim() || undefined, valid: Number.isFinite(received) && received >= 0 && damaged >= 0 && damaged <= received, needsNote };
  });
  const ok = lines.every((l) => l.valid && !l.needsNote);

  const submit = () => {
    if (!ok) return;
    const clean = lines.map(({ materialId, received, damaged, note: n }) => ({ materialId, received, damaged, note: n }));
    save((db, c) => (kind === 'dispatch' ? receiveDispatch(db, c, row as DispatchRow, clean, note.trim() || undefined) : receivePurchase(db, c, row as PurchaseRow, clean, note.trim() || undefined)));
    router.back();
  };

  return (
    <Screen header={<Header back title={`${t('maal.receive')} · ${title}`} />} refresh={false} footer={<BigButton testID="save-receive" label={t('common.save')} disabled={!ok} onPress={submit} />}>
      {row.blindCount ? <StatusChip tone="primary" icon="🙈" label={t('maal.blind')} /> : null}
      {row.items.map((i, n) => {
        const m = data.mats.get(i.materialId);
        const v = inputs[i.materialId] ?? { received: '', damaged: '', note: '' };
        const set = (patch: Partial<Input>) => setInputs((x) => ({ ...x, [i.materialId]: { ...v, ...patch } }));
        const exp = expected(i);
        return (
          <View key={i.id} className="gap-2 rounded-card border border-border bg-card p-3">
            <Text className="font-semibold text-base text-ink">
              {m?.name ?? '—'}
              {exp !== null ? <Text className="font-normal text-sm text-muted"> · {t('maal.sent')} {qty(exp)}</Text> : null}
            </Text>
            <QuantityInput testID={`received-${m?.name ?? n}`} label={t('maal.counted')} value={v.received} unit={m?.unit} onChange={(received) => set({ received })} />
            <QuantityInput label={`${t('maal.damaged')} (${t('common.optional')})`} value={v.damaged} unit={m?.unit} onChange={(damaged) => set({ damaged })} />
            {lines[n]?.needsNote || v.note ? (
              <TextInput value={v.note} onChangeText={(x) => set({ note: x })} placeholder={t('maal.shortNote')} placeholderTextColor="#94A3B8" className="min-h-12 rounded-card border border-warning bg-card px-3 text-base text-ink" />
            ) : null}
          </View>
        );
      })}
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor="#94A3B8" className="min-h-14 rounded-card border border-border bg-card px-4 text-base text-ink" />
    </Screen>
  );
}
