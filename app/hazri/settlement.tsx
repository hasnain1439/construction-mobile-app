import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { MoneyText } from '@components/MoneyText';
import { Screen } from '@components/Screen';
import { StatusChip, type Tone } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { generateSettlement, paySettlement, submitSettlement } from '@/features/actions';
import { useProject } from '@/features/project';
import { cashAccount, settings, settlementFor, siteWorkers } from '@/features/queries';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { addDays, shortDate, todayPK, weekOf, type WeekDay } from '@/lib/dates';
import { formatPKR, toPaisa } from '@/lib/money';
import { CARD_SHADOW, COLORS, RAISED_SHADOW } from '@/lib/theme';

const TONE: Record<string, Tone> = { DRAFT: 'neutral', SUBMITTED: 'primary', APPROVED: 'success', RETURNED: 'danger' };

/** Weekly wages: make the week, send for approval, pay approved lines from site cash. */
export default function SettlementScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const [day, setDay] = useState(todayPK());
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'submit' | 'pay' | null>(null);
  const data = useQuery(
    (db) => {
      if (!projectId) return null;
      const week = weekOf(day, settings(db).settlementWeekStart as WeekDay);
      const names = new Map(siteWorkers(db, projectId).map((w) => [w.worker.id, w.worker.name]));
      return { week, settlement: settlementFor(db, projectId, week.weekStart), names, account: cashAccount(db) };
    },
    [projectId, day],
  );
  if (!projectId || !data) return null;
  const s = data.settlement;
  const payable = s?.status === 'APPROVED' ? s.lines.filter((l) => l.paymentStatus !== 'PAID' && toPaisa(l.netPaisa) > 0n) : [];
  const payTotal = payable.filter((l) => selected.includes(l.id)).reduce((sum, l) => sum + toPaisa(l.netPaisa), 0n);
  const enough = !data.account || toPaisa(data.account.balancePaisa) >= payTotal;

  return (
    <Screen header={<Header back title={t('hazri.settlement')} subtitle={`${shortDate(data.week.weekStart)} – ${shortDate(data.week.weekEnd)}`} />}>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <BigButton small variant="secondary" icon="chevron-left" label={t('hazri.prevWeek')} onPress={() => setDay(addDays(data.week.weekStart, -1))} />
        </View>
        <View className="flex-1">
          <BigButton small variant="secondary" icon="calendar-today" label={`${t('hazri.thisWeek')}`} disabled={todayPK() >= data.week.weekStart && todayPK() <= data.week.weekEnd} onPress={() => setDay(todayPK())} />
        </View>
      </View>

      {!s ? (
        <EmptyState icon="🗓️" title={t('hazri.noSettlement')} action={{ label: t('hazri.generate'), onPress: () => save((db, c) => generateSettlement(db, c, { projectId, day })) }} />
      ) : (
        <>
          <View className="gap-3 overflow-hidden rounded-card bg-brand-light p-5" style={RAISED_SHADOW}>
            <View className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5" />
            <View className="flex-row items-center justify-between">
              <StatusChip tone={TONE[s.status] ?? 'neutral'} label={t(`settlement.${s.status}` as never)} />
              {s.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('maal.waitingSync')}`} /> : null}
            </View>
            {s.netPaisa !== null ? (
              <View>
                <Text className="font-medium text-sm text-brand-muted">{t('hazri.net')}</Text>
                <MoneyText paisa={s.netPaisa} className="mt-1 text-3xl !text-white" />
              </View>
            ) : null}
            {s.returnComment ? (
              <View className="flex-row items-start gap-2 rounded-xl bg-danger-soft px-3 py-2">
                <Icon name="undo" size={18} color={COLORS.danger} />
                <Text className="flex-1 text-sm text-danger">{s.returnComment}</Text>
              </View>
            ) : null}
          </View>

          {s.lines.map((l) => {
            const paid = l.paymentStatus === 'PAID';
            const canPick = payable.some((p) => p.id === l.id);
            const on = selected.includes(l.id);
            return (
              <Pressable
                key={l.id}
                disabled={!canPick}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !canPick }}
                onPress={() => setSelected((x) => (on ? x.filter((i) => i !== l.id) : [...x, l.id]))}
                className={`min-h-16 flex-row items-center gap-3 rounded-card border p-4 ${on ? 'border-primary bg-primary-soft' : 'border-transparent bg-card'}`}
                style={CARD_SHADOW}
              >
                {canPick ? <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={on ? COLORS.primary : COLORS.neutral} /> : null}
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{data.names.get(l.workerId) ?? '—'}</Text>
                  <Text className="text-xs text-muted">
                    {t('hazri.days')}: {l.daysWorked ?? l.fullDays + l.halfDays / 2}
                    {l.overtimeHours ? ` · OT ${l.overtimeHours}h` : ''}
                    {toPaisa(l.advanceAdjustedPaisa) > 0n ? ` · ${t('hazri.peshgi')} −${formatPKR(l.advanceAdjustedPaisa)}` : ''}
                  </Text>
                </View>
                <View className="items-end">
                  <MoneyText paisa={l.netPaisa} />
                  {paid ? <StatusChip tone="success" label={t('hazri.paid')} /> : null}
                </View>
              </Pressable>
            );
          })}

          {s.status === 'DRAFT' || s.status === 'RETURNED' ? <BigButton label={t('hazri.submit')} onPress={() => setConfirm('submit')} /> : null}
          {payable.length ? (
            <>
              {!enough ? <Text className="text-sm text-danger">{t('hazri.notEnoughCash')}</Text> : null}
              <BigButton variant="accent" label={`${t('hazri.pay')}${payTotal ? ` · ${formatPKR(payTotal)}` : ''}`} disabled={!selected.length || !enough} onPress={() => setConfirm('pay')} />
            </>
          ) : null}
        </>
      )}

      <ConfirmSheet
        visible={confirm !== null}
        title={confirm === 'pay' ? t('hazri.pay') : t('hazri.submit')}
        body={confirm === 'pay' ? formatPKR(payTotal) : undefined}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (s && confirm === 'submit') save((db, c) => submitSettlement(db, c, s));
          if (s && confirm === 'pay') save((db, c) => paySettlement(db, c, s, selected));
          setSelected([]);
          setConfirm(null);
        }}
      />
    </Screen>
  );
}
