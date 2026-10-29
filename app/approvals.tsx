import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BottomSheet } from '@components/BottomSheet';
import { ChoiceChips } from '@components/ChoiceChips';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { IconBadge } from '@components/IconBadge';
import { MoneyText } from '@components/MoneyText';
import { RouteGuard } from '@components/RouteGuard';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import {
  APPROVAL_ICON,
  APPROVE_KEY,
  approvalErrorCode,
  canUseInbox,
  fetchApprovals,
  FLOAT_METHODS,
  fromServer,
  groupApprovals,
  INBOX_KINDS,
  localApprovals,
  NOTE_MIN,
  runApproval,
  setServerApprovalsCount,
  type ActionInput,
  type FloatMethod,
  type PhoneAction,
  type PhoneApproval,
} from '@/features/approvals';
import { errorText, useI18n, type TKey } from '@/i18n';
import { formatPKR } from '@/lib/money';
import { COLORS, CARD_SHADOW } from '@/lib/theme';
import { syncFromApp } from '@/sync/triggers';

const keyOf = (i: Pick<PhoneApproval, 'kind' | 'id'>) => `${i.kind}:${i.id}`;
type Load = 'loading' | 'ready' | 'offline' | 'error';
type Notice = { tone: 'success' | 'danger'; text: string } | null;

const ApprovalCard = memo(function ApprovalCard({ item, busy, onAction }: { item: PhoneApproval; busy: boolean; onAction: (item: PhoneApproval, action: PhoneAction) => void }) {
  const { t } = useI18n();
  const waiting = item.ageDays <= 0 ? t('appr.waitingToday') : t('appr.waitingDays', { n: item.ageDays });
  const overLimit = item.actions.some((a) => a.overLimit);
  return (
    <View testID={`approval-${item.id}`} className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
      <View className="flex-row items-center gap-3">
        <IconBadge name={APPROVAL_ICON[item.kind]} tone="primary" size={40} />
        <View className="flex-1">
          <Text className="font-semibold text-base text-ink" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-sm text-muted" numberOfLines={2}>
            {[item.projectName, item.subtitle, waiting].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {item.amountPaisa !== null ? <MoneyText paisa={item.amountPaisa} className="text-base" /> : null}
      </View>
      {overLimit ? <Text className="text-sm text-warning">{t('appr.aboveLimit', { limit: formatPKR(item.limitPaisa) })}</Text> : null}
      {item.actions.length ? (
        <View className="flex-row gap-2">
          {item.actions.map((a) => (
            <View key={a.action} className="flex-1">
              <BigButton
                small
                testID={`${a.action}-${item.id}`}
                label={t(a.label)}
                variant={a.decline ? 'secondary' : 'primary'}
                disabled={busy || a.overLimit}
                loading={busy}
                onPress={() => onAction(item, a)}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-muted">{t('appr.noQuick')}</Text>
      )}
    </View>
  );
});

/**
 * "Meri approvals": everything waiting on this person that the phone can decide, grouped by kind.
 * Online only — the decisions go straight to the server; a sync pull then updates the phone.
 */
function ApprovalsInbox() {
  const { t, f, language } = useI18n();
  const p = usePermissions();
  const accessKey = JSON.stringify(p.access);
  // Stable across re-reads of the same permissions (a pull re-reads the access block).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const access = useMemo(() => p.access, [accessKey]);
  const role = p.role;
  const inbox = canUseInbox(access, role);
  const anyInboxKey = INBOX_KINDS.some((k) => p.can(APPROVE_KEY[k]));

  const [server, setServer] = useState<PhoneApproval[]>([]);
  const [loadState, setLoad] = useState<Load>('loading');
  const load: Load = inbox ? loadState : 'ready';
  const [loadError, setLoadError] = useState('generic');
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [asking, setAsking] = useState<{ item: PhoneApproval; action: PhoneAction } | null>(null);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<FloatMethod>('CASH');

  const local = useQuery((db) => localApprovals(db, access, role, { t, shortDate: f.shortDate }), [access, role, language]);

  // Without the inbox permission only the synced stoppages / snags are shown (`load` is then 'ready').
  const fetchInbox = useCallback(
    (): Promise<void> =>
      inbox
        ? fetchApprovals().then(
            (res) => {
              const items = fromServer(res, access, role);
              setServer(items);
              setServerApprovalsCount(items.length);
              setLoad('ready');
            },
            (err: unknown) => {
              const code = approvalErrorCode(err);
              setLoadError(code);
              setLoad(code === 'OFFLINE' ? 'offline' : 'error');
            },
          )
        : Promise.resolve(),
    [inbox, access, role],
  );

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      await Promise.all([fetchInbox(), syncFromApp()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInbox]);

  const items = useMemo(() => [...server, ...local].filter((i) => !done.has(keyOf(i))), [server, local, done]);
  const groups = useMemo(() => groupApprovals(items), [items]);

  // 'OFFLINE' (no internet) has its own message: approving needs internet.
  const failText = (code: string) => errorText(language, code);

  const run = async (item: PhoneApproval, action: PhoneAction, input: ActionInput = {}) => {
    setBusy(keyOf(item));
    setNotice(null);
    try {
      await runApproval(item, action.action, input);
      setDone((prev) => new Set(prev).add(keyOf(item)));
      setAsking(null);
      setNotice({ tone: 'success', text: t('appr.done') });
      // The list from the server, then a pull so the phone's own rows (kharcha, hazri, stoppages, snags) update.
      void fetchInbox();
      void syncFromApp();
    } catch (err) {
      const code = approvalErrorCode(err);
      setNotice({ tone: 'danger', text: failText(code) });
      // Someone else decided it, or it is no longer ours: refresh the list.
      if (code !== 'OFFLINE' && code !== 'NOTE_REQUIRED' && code !== 'METHOD_REQUIRED') void fetchInbox();
    } finally {
      setBusy(null);
    }
  };

  const onAction = (item: PhoneApproval, action: PhoneAction) => {
    if (action.overLimit) return;
    if (action.needsNote || action.needsMethod) {
      setNote('');
      setMethod('CASH');
      setNotice(null);
      setAsking({ item, action });
    } else void run(item, action);
  };

  const noteShort = !!asking?.action.needsNote && note.trim().length < NOTE_MIN;
  const bannerText = load === 'offline' ? t('appr.offline') : load === 'error' ? failText(loadError) : null;

  return (
    <Screen header={<Header back title={t('appr.title')} />} scroll={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-4 pb-24"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        {bannerText ? (
          <View testID="approvals-offline" className="rounded-card bg-warning-soft p-3">
            <Text className="text-sm text-ink">{bannerText}</Text>
          </View>
        ) : null}
        {!inbox && anyInboxKey ? (
          <View testID="approvals-no-inbox" className="rounded-card bg-primary-soft p-3">
            <Text className="text-sm text-ink">{t('appr.noInbox')}</Text>
          </View>
        ) : null}
        {notice && !asking ? (
          <View testID="approvals-notice" className={`rounded-card p-3 ${notice.tone === 'success' ? 'bg-success-soft' : 'bg-danger-soft'}`}>
            <Text className="text-sm text-ink">{notice.text}</Text>
          </View>
        ) : null}

        {load === 'loading' && !local.length ? <Text className="text-center text-sm text-muted">{t('common.loading')}</Text> : null}
        {load !== 'loading' && !groups.length ? <EmptyState icon="✅" title={t('appr.empty')} body={t('appr.emptyBody')} /> : null}

        {groups.map((g) => (
          <View key={g.kind} className="gap-3">
            <View className="mt-2 flex-row items-center gap-2">
              <Text className="flex-1 font-bold text-lg text-ink">{t(`appr.group.${g.kind}` as TKey)}</Text>
              <StatusChip tone="primary" label={String(g.items.length)} />
            </View>
            {g.items.map((item) => (
              <ApprovalCard key={keyOf(item)} item={item} busy={busy === keyOf(item)} onAction={onAction} />
            ))}
          </View>
        ))}
      </ScrollView>

      <BottomSheet visible={!!asking} onClose={() => (busy ? undefined : setAsking(null))} title={asking ? t(asking.action.label) : undefined}>
        {asking ? <Text className="text-base text-ink">{asking.item.title}</Text> : null}
        {asking?.action.needsMethod ? (
          <>
            <Text className="font-semibold text-sm text-muted">{t('appr.sendBy')}</Text>
            <ChoiceChips<FloatMethod> testIDPrefix="method" options={FLOAT_METHODS.map((m) => ({ id: m, label: t(`method.${m}` as TKey) }))} value={method} onChange={setMethod} />
          </>
        ) : null}
        {asking?.action.needsNote ? (
          <TextInput
            testID="approval-note"
            value={note}
            onChangeText={setNote}
            placeholder={t('appr.reason')}
            placeholderTextColor={COLORS.neutral}
            multiline
            maxLength={500}
            className="min-h-20 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
          />
        ) : null}
        {notice?.tone === 'danger' && asking ? <Text className="text-sm text-danger">{notice.text}</Text> : null}
        {asking ? (
          <BigButton
            testID="approval-confirm"
            label={t(asking.action.label)}
            variant={asking.action.decline ? 'danger' : 'primary'}
            disabled={noteShort}
            loading={busy === keyOf(asking.item)}
            onPress={() => void run(asking.item, asking.action, { ...(asking.action.needsNote ? { note: note.trim() } : {}), ...(asking.action.needsMethod ? { method } : {}) })}
          />
        ) : null}
        <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setAsking(null)} />
      </BottomSheet>
    </Screen>
  );
}

/** A single screen outside the tab stacks: guarded here (ROUTE_PERMS['/approvals'] = any approve key). */
export default function ApprovalsScreen() {
  return (
    <RouteGuard>
      <ApprovalsInbox />
    </RouteGuard>
  );
}
