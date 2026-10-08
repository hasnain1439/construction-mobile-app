import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BottomSheet } from '@components/BottomSheet';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { ListItem } from '@components/ListItem';
import { MoneyText } from '@components/MoneyText';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { giveAdvance } from '@/features/actions';
import { useProject } from '@/features/project';
import { advances, assignments, cashAccount, isEnoughCash, siteWorkers } from '@/features/queries';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { shortDate, todayPK } from '@/lib/dates';
import { formatPKR, rupeesToPaisa } from '@/lib/money';
import { COLORS } from '@/lib/theme';

/** Peshgi (advance) to a worker or a sub-contractor, paid from the munshi's site cash. */
export default function PeshgiScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const [payeeType, setPayeeType] = useState<'WORKER' | 'SUBCONTRACTOR'>('WORKER');
  const [payee, setPayee] = useState<{ id: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const data = useQuery((db) => (projectId ? { workers: siteWorkers(db, projectId), subs: assignments(db, projectId), account: cashAccount(db), recent: advances(db, projectId).slice(0, 10) } : null), [projectId]);
  if (!projectId || !data) return null;

  const paisa = rupeesToPaisa(amount);
  const enough = paisa ? isEnoughCash(data.account, paisa) : true;
  const options = payeeType === 'WORKER' ? data.workers.map((w) => ({ id: w.worker.id, name: w.worker.name })) : data.subs.map((s) => ({ id: s.id, name: `${s.subcontractor.name} — ${s.scope}` }));

  const submit = () => {
    if (!payee || !paisa || !enough) return;
    save((db, c) =>
      giveAdvance(db, c, {
        projectId,
        payeeType,
        ...(payeeType === 'WORKER' ? { workerId: payee.id } : { assignmentId: payee.id }),
        amountPaisa: paisa,
        date: todayPK(),
        note: note.trim() || undefined,
        label: `Peshgi ${formatPKR(paisa)} — ${payee.name}`,
      }),
    );
    router.back();
  };

  return (
    <Screen header={<Header back title={t('hazri.peshgi')} />} refresh={false} footer={<BigButton testID="save-peshgi" label={t('common.save')} disabled={!payee || !paisa || !enough} onPress={submit} />}>
      <View className="flex-row gap-2">
        {(['WORKER', 'SUBCONTRACTOR'] as const).map((p) => (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ selected: payeeType === p }}
            onPress={() => {
              setPayeeType(p);
              setPayee(null);
            }}
            className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border ${payeeType === p ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
          >
            <Icon name={p === 'WORKER' ? 'account-hard-hat' : 'account-tie-outline'} size={20} color={payeeType === p ? COLORS.primary : COLORS.muted} />
            <Text className={payeeType === p ? 'font-semibold text-primary' : 'text-ink'}>{t(p === 'WORKER' ? 'hazri.worker' : 'hazri.subcontractor')}</Text>
          </Pressable>
        ))}
      </View>
      <ListItem title={payee?.name ?? t('hazri.peshgiTo')} subtitle={payee ? t('hazri.peshgiTo') : undefined} icon={payeeType === 'WORKER' ? '👷' : '🤝'} iconTone="primary" right={<Icon name="chevron-down" size={22} color={COLORS.neutral} />} onPress={() => setPicking(true)} testID="pick-payee" />
      <QuantityInput testID="peshgi-amount" money label={t('common.amount')} value={amount} onChange={setAmount} error={paisa && !enough ? t('hazri.notEnoughCash') : null} />
      {data.account ? <Text className="text-sm text-muted">{t('hazri.fromCash', { amount: formatPKR(data.account.balancePaisa) })}</Text> : null}
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />

      {data.recent.length ? <Text className="mt-3 font-bold text-lg text-ink">{t('hazri.recentPeshgi')}</Text> : null}
      {data.recent.map((a) => {
        const name = a.workerId ? data.workers.find((w) => w.worker.id === a.workerId)?.worker.name : data.subs.find((s) => s.id === a.assignmentId)?.subcontractor.name;
        return <ListItem key={a.id} title={name ?? '—'} subtitle={`${shortDate(a.date)}${a.pendingSync ? ` · ${t('kharcha.notSynced')}` : ''}`} icon={a.pendingSync ? 'timer-sand' : '🤝'} iconTone={a.pendingSync ? 'warning' : 'success'} right={<MoneyText paisa={a.amountPaisa} />} />;
      })}

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={t('hazri.peshgiTo')}>
        {options.map((o) => (
          <ListItem
            key={o.id}
            title={o.name}
            icon={payeeType === 'WORKER' ? '👷' : '🤝'}
            iconTone="primary"
            onPress={() => {
              setPayee(o);
              setPicking(false);
            }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
