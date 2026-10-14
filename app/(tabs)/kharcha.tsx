import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { IconBadge } from '@components/IconBadge';
import { Header } from '@components/Header';
import { MoneyText } from '@components/MoneyText';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip, type Tone } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { acknowledgeFloat } from '@/features/actions';
import { cashAccount, cashEntries, pendingFloats, topups } from '@/features/queries';
import { usePermissions } from '@/features/access';
import type { CashEntryRow } from '@/features/types';
import { useSave } from '@/features/useSave';
import { translateMaybe, useI18n, type TKey } from '@/i18n';
import { formatPKR, toPaisa } from '@/lib/money';
import { PERM, rules } from '@/lib/permissions';
import { CARD_SHADOW, COLORS, RAISED_SHADOW } from '@/lib/theme';

const STATUS: Record<string, { key: TKey; tone: Tone }> = {
  POSTED: { key: 'kharcha.posted', tone: 'success' },
  APPROVED: { key: 'kharcha.approved', tone: 'success' },
  PENDING_APPROVAL: { key: 'kharcha.pendingApproval', tone: 'warning' },
  PENDING_ACK: { key: 'kharcha.pendingFloats', tone: 'primary' },
  REJECTED: { key: 'kharcha.rejected', tone: 'danger' },
};

/** One list row, memoised so FlashList recycling and unrelated state changes don't re-render every row. */
const CashEntryItem = memo(function CashEntryItem({ e }: { e: CashEntryRow }) {
  const { t, f: fmt, language } = useI18n();

  const st = STATUS[e.status];
  return (
    <View className="mx-4 mb-2 min-h-16 flex-row items-center gap-3 rounded-card bg-card p-3" style={CARD_SHADOW}>
      <IconBadge name="🧾" tone={e.amountPaisa.startsWith('-') ? 'danger' : 'success'} size={40} />
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-ink" numberOfLines={1}>
          {e.category ? t(`cat.${e.category}` as TKey) : (translateMaybe(language, `cashType.${e.type}`) ?? e.type)} · {e.description}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          {e.pendingSync ? <StatusChip tone="accent" label={`⏳ ${t('kharcha.notSynced')}`} /> : st ? <StatusChip tone={st.tone} label={t(st.key)} /> : null}
          {e.lateSync ? <StatusChip tone="neutral" label={`📱 ${t('sync.lateSync')}`} /> : null}
        </View>
        {e.reviewNote ? <Text className="text-xs text-danger">{e.reviewNote}</Text> : null}
      </View>
      <View className="items-end">
        <MoneyText paisa={e.amountPaisa} signed />
        <Text className="text-xs text-muted">{fmt.dateTime(e.occurredAt)}</Text>
      </View>
    </View>
  );
});

/** My site cash: balance, cash sent to me, kharcha entries. */
export default function KharchaScreen() {
  const { t, f: fmt, language } = useI18n();
  const save = useSave();
  const perms = usePermissions();
  const [ack, setAck] = useState<CashEntryRow | null>(null);
  const data = useQuery((db) => {
    const account = cashAccount(db);
    return { account, entries: cashEntries(db, account?.id), floats: pendingFloats(db, account?.id), topup: topups(db).find((x) => x.status === 'PENDING') ?? null };
  }, []);
  const header = <Header title={t('kharcha.title')} right={<ProjectSwitcher />} />;
  if (!data.account) {
    return (
      <Screen header={header}>
        <EmptyState icon="💵" title={t('kharcha.noAccount')} />
      </Screen>
    );
  }
  const a = data.account;

  const top = (
    <View className="gap-3 p-4">
      <View className="gap-2 overflow-hidden rounded-card bg-sand p-5" style={RAISED_SHADOW}>
        <View className="absolute -bottom-6 -right-4 opacity-15">
          <Icon name="wallet-outline" size={120} color={COLORS.ink} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-sm text-ink">{t('kharcha.balance')}</Text>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-white/45">
            <Icon name="wallet-outline" size={18} color={COLORS.ink} />
          </View>
        </View>
        <Text testID="cash-balance" className="font-bold text-3xl text-ink">
          {formatPKR(a.balancePaisa)}
        </Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {toPaisa(a.pendingAckPaisa) ? (
            <Text className="text-sm text-ink/70">
              {t('kharcha.pendingFloats')}: {formatPKR(a.pendingAckPaisa)}
            </Text>
          ) : null}
          {toPaisa(a.pendingApprovalPaisa) ? (
            <Text className="text-sm text-ink/70">
              {t('kharcha.pendingApproval')}: {formatPKR(a.pendingApprovalPaisa)}
            </Text>
          ) : null}
          {toPaisa(a.recoverablePaisa) ? (
            <Text className="text-sm text-ink/70">
              {t('kharcha.recoverable')}: {formatPKR(a.recoverablePaisa)}
            </Text>
          ) : null}
        </View>
      </View>
      {perms.can(PERM.expenseCreate) ? <BigButton testID="add-kharcha" icon="➕" label={t('kharcha.add')} onPress={() => router.push('/kharcha/new')} /> : null}
      {rules.requestTopup(perms.access, perms.role) ? (
        data.topup ? (
          <StatusChip tone="primary" icon="⏳" label={t('kharcha.topupPending', { amount: formatPKR(data.topup.amountPaisa) })} />
        ) : (
          <BigButton variant="secondary" icon="🙏" label={t('kharcha.topup')} onPress={() => router.push('/kharcha/topup')} />
        )
      ) : null}
      {data.floats.length ? <Text className="mt-2 font-bold text-lg text-ink">{t('kharcha.floats')}</Text> : null}
      {data.floats.map((f) => (
        <View key={f.id} className="flex-row items-center gap-3 rounded-card border border-primary/30 bg-primary-soft p-3">
          <IconBadge name="hand-coin-outline" tone="primary" size={40} />
          <View className="flex-1">
            <MoneyText paisa={f.amountPaisa} className="text-lg" />
            <Text className="text-xs text-muted">{[f.method ? (translateMaybe(language, `method.${f.method}`) ?? f.method) : null, f.description, fmt.dateTime(f.occurredAt)].filter(Boolean).join(' · ')}</Text>
          </View>
          {perms.can(PERM.cashView) ? <BigButton small label={t('kharcha.acknowledge')} onPress={() => setAck(f)} /> : null}
        </View>
      ))}
      <Text className="mt-2 font-bold text-lg text-ink">{t('kharcha.entries')}</Text>
    </View>
  );

  return (
    <Screen header={header} scroll={false}>
      <FlashList
        data={data.entries.filter((e) => e.status !== 'PENDING_ACK')}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={top}
        ListEmptyComponent={
          <View className="px-4">
            <EmptyState icon="🧾" title={t('common.empty')} />
          </View>
        }
        renderItem={({ item }) => <CashEntryItem e={item} />}
      />
      <ConfirmSheet
        visible={!!ack}
        title={t('kharcha.acknowledge')}
        body={ack ? formatPKR(ack.amountPaisa) : undefined}
        onClose={() => setAck(null)}
        onConfirm={() => {
          if (ack) save((db, c) => acknowledgeFloat(db, c, ack));
          setAck(null);
        }}
      />
    </Screen>
  );
}
