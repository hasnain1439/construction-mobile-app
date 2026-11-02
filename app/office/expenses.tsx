import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BarList, ChartCard } from '@components/Charts';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { MoneyText } from '@components/MoneyText';
import { OfficeCard, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { StatTile } from '@components/StatTile';
import { ENDPOINTS } from '@/api/endpoints';
import { usePermissions } from '@/features/access';
import { monthRange, OFFICE_PERM, shiftMonth, useOfficeExpensesVersion, useOnline, type OfficeExpense, type OfficeExpensesMeta } from '@/features/office';
import { useI18n, type TKey } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { formatPKR, toPaisa } from '@/lib/money';
import { COLORS } from '@/lib/theme';

/** Opens the form to change / delete one expense (the list already has every field; there is no GET by id). */
const openExpense = (e: OfficeExpense) =>
  router.push({
    pathname: '/office/expense-new',
    params: { id: e.id, date: e.date, category: e.category, amountPaisa: e.amountPaisa, paidVia: e.paidVia, paidTo: e.paidTo ?? '', description: e.description },
  } as never);

/**
 * Office → Office expenses: the company's running costs not tied to a site (rent, bills, salaries),
 * one month at a time — the total, a bar per type, then every entry. People with the manage key add
 * one from the button below and tap an entry to change or delete it. Online only.
 */
export default function OfficeExpenses() {
  const { t, f } = useI18n();
  const p = usePermissions();
  const manage = p.can(OFFICE_PERM.expensesManage);
  const thisMonth = todayPK().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const version = useOfficeExpensesVersion();
  const { state, data, reload, refetch } = useOnline<{ data: OfficeExpense[]; meta: OfficeExpensesMeta }>(ENDPOINTS.officeExpenses, { ...monthRange(month), limit: 100 }, { envelope: true, version });
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const [y, m] = month.split('-');
  const monthLabel = `${t(`date.m${Number(m)}` as TKey)} ${y}`;
  const catLabel = (c: string) => t(`oexp.cat.${c}` as TKey);

  return (
    <Screen
      onRefresh={refetch}
      refresh={false}
      header={<Header back title={t('office.expenses')} />}
      footer={manage ? <BigButton testID="oexp-add" icon="plus" label={t('oexp.add')} onPress={() => router.push('/office/expense-new' as never)} /> : undefined}
    >
      <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-2 py-1">
        <Pressable testID="oexp-prev" accessibilityRole="button" accessibilityLabel={t('oexp.prevMonth')} hitSlop={8} onPress={() => setMonth(shiftMonth(month, -1))} className="h-11 w-11 items-center justify-center rounded-full active:bg-bg">
          <Icon name="chevron-left" size={24} color={COLORS.ink} />
        </Pressable>
        <Text testID="oexp-month" className="font-semibold text-base text-ink">
          {monthLabel}
        </Text>
        <Pressable
          testID="oexp-next"
          accessibilityRole="button"
          accessibilityLabel={t('oexp.nextMonth')}
          accessibilityState={{ disabled: month >= thisMonth }}
          disabled={month >= thisMonth}
          hitSlop={8}
          onPress={() => setMonth(shiftMonth(month, 1))}
          className={`h-11 w-11 items-center justify-center rounded-full active:bg-bg ${month >= thisMonth ? 'opacity-30' : ''}`}
        >
          <Icon name="chevron-right" size={24} color={COLORS.ink} />
        </Pressable>
      </View>
      <OfficeState state={state} onRetry={() => void reload()}>
        <View className="flex-row flex-wrap gap-3">
          <StatTile testID="oexp-total" label={t('oexp.total')}>
            <MoneyText paisa={meta?.totalPaisa ?? '0'} className="text-lg" />
          </StatTile>
          <StatTile label={t('oexp.count')}>{meta?.total ?? rows.length}</StatTile>
        </View>
        {meta?.byCategory.length ? (
          <ChartCard title={t('oexp.byCategory')} subtitle={monthLabel} testID="oexp-by-category">
            <BarList rows={meta.byCategory.map((c) => ({ key: c.category, label: catLabel(c.category), value: Number(toPaisa(c.totalPaisa) / 100n), display: formatPKR(c.totalPaisa) }))} />
          </ChartCard>
        ) : null}
        {!rows.length ? <Text className="py-6 text-center text-sm text-muted">{t('office.empty')}</Text> : null}
        {rows.map((e) => {
          const lines: [string, React.ReactNode][] = [[t('oexp.paidVia'), t(`method.${e.paidVia}` as TKey)]];
          if (e.paidTo) lines.push([t('oexp.paidTo'), e.paidTo]);
          if (e.createdBy) lines.push([t('oexp.addedBy'), e.createdBy.name]);
          return (
            <OfficeCard
              key={e.id}
              testID={`oexp-${e.id}`}
              title={e.description}
              subtitle={`${f.shortDate(e.date)} · ${catLabel(e.category)}`}
              right={<MoneyText paisa={e.amountPaisa} className="text-base" />}
              lines={lines}
              onPress={manage ? () => openExpense(e) : undefined}
            />
          );
        })}
        {meta && meta.total > rows.length ? <Text className="text-center text-xs text-muted">{t('oexp.showing', { n: rows.length, total: meta.total })}</Text> : null}
      </OfficeState>
    </Screen>
  );
}
