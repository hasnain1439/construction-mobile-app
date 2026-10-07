import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { getDb } from '@/db/client';
import { notifyChange, useQuery } from '@/db/live';
import { errorText, useI18n } from '@/i18n';
import { dateTime } from '@/lib/dates';
import { refreshStatus } from '@/sync/engine';
import { dismissProblem, problems } from '@/sync/outbox';

/** Entries the server refused. The change was undone on the phone; the reason is shown in the munshi's language. */
export default function SyncProblemsScreen() {
  const { t, language } = useI18n();
  const list = useQuery((db) => problems(db), []);
  return (
    <Screen header={<Header back title={t('sync.problemsTitle')} />}>
      {!list.length ? <EmptyState icon="✅" title={t('sync.noProblems')} /> : null}
      {list.map((p) => {
        const err = p.lastError ? (JSON.parse(p.lastError) as { code?: string }) : null;
        return (
          <View key={p.clientId} testID="problem" className="gap-2 rounded-card border border-danger bg-card p-3">
            <Text className="font-semibold text-ink">{p.label}</Text>
            <Text className="text-sm text-danger">{errorText(language, err?.code)}</Text>
            <Text className="text-xs text-muted">
              {dateTime(p.deviceCreatedAt)} · {t('sync.undone')}
            </Text>
            <BigButton
              small
              variant="secondary"
              label={t('sync.dismiss')}
              onPress={() => {
                const db = getDb();
                dismissProblem(db, p.clientId);
                notifyChange();
                refreshStatus(db);
              }}
            />
          </View>
        );
      })}
    </Screen>
  );
}
