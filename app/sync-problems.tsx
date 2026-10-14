import { FlashList } from '@shopify/flash-list';
import { memo, useCallback } from 'react';
import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { IconBadge } from '@components/IconBadge';
import { Screen } from '@components/Screen';
import { getDb } from '@/db/client';
import { notifyChange, useQuery } from '@/db/live';
import { outboxTitle, rejectedText, useI18n } from '@/i18n';
import { CARD_SHADOW } from '@/lib/theme';
import { refreshStatus } from '@/sync/engine';
import { dismissProblem, problems, type OutboxItem } from '@/sync/outbox';

/** One refused entry (memoised: dismissing one does not re-render the others). */
const ProblemRow = memo(function ProblemRow({ item: p, onDismiss }: { item: OutboxItem; onDismiss: (clientId: string) => void }) {
  const { t, f, language } = useI18n();
  const title = outboxTitle(language, p.type);
  return (
    <View testID="problem" className="mb-3 gap-3 rounded-card bg-card p-4" style={CARD_SHADOW}>
      <View className="flex-row gap-3">
        <IconBadge name="alert-circle-outline" tone="danger" size={40} />
        <View className="flex-1 gap-1">
          <Text className="font-semibold text-ink">{title ?? p.label}</Text>
          {title && p.label ? <Text className="text-sm text-muted">{p.label}</Text> : null}
          <Text className="text-sm text-danger">{rejectedText(language, p.lastError)}</Text>
          <Text className="text-xs text-muted">
            {f.dateTime(p.deviceCreatedAt)} · {t('sync.undone')}
          </Text>
        </View>
      </View>
      <BigButton small variant="secondary" label={t('sync.dismiss')} onPress={() => onDismiss(p.clientId)} />
    </View>
  );
});

/** Entries the server refused. The change was undone on the phone; the reason is shown in the munshi's language. */
export default function SyncProblemsScreen() {
  const { t } = useI18n();
  const list = useQuery((db) => problems(db), []);
  const dismiss = useCallback((clientId: string) => {
    const db = getDb();
    dismissProblem(db, clientId);
    notifyChange();
    refreshStatus(db);
  }, []);
  return (
    <Screen header={<Header back title={t('sync.problemsTitle')} />} scroll={false}>
      <FlashList
        data={list}
        keyExtractor={(p) => p.clientId}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState icon="✅" title={t('sync.noProblems')} />}
        renderItem={({ item }) => <ProblemRow item={item} onDismiss={dismiss} />}
      />
    </Screen>
  );
}
