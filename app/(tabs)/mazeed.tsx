import { formatDistanceToNowStrict } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { APP_VERSION } from '@/api/config';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import { useSession, useUser } from '@/features/session';
import type { NotificationRow } from '@/features/types';
import { useI18n, type Language } from '@/i18n';
import { displayPhone } from '@/lib/phone';
import { syncFromApp } from '@/sync/triggers';
import { useSyncStatus } from '@/sync/useSyncStatus';

const LANGS: { id: Language; label: string }[] = [
  { id: 'roman', label: 'Roman Urdu' },
  { id: 'ur', label: 'اردو' },
  { id: 'en', label: 'English' },
];

export default function MazeedScreen() {
  const { t, language, setLanguage } = useI18n();
  const user = useUser();
  const { logout } = useSession();
  const s = useSyncStatus();
  const unread = useQuery((db) => listRows<NotificationRow>(db, 'notifications').filter((n) => !n.read).length, []);
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogout = async (force: boolean) => {
    setBusy(true);
    try {
      const res = await logout(force);
      // Entries could not be sent: warn before deleting them from the phone.
      if (!res.done) setConfirm({ pending: res.pending });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<Header title={t('mazeed.title')} right={<ProjectSwitcher />} />}>
      <ListItem left={<Text className="text-2xl">📝</Text>} title={t('mazeed.dailyLog')} onPress={() => router.push('/log/today')} />
      <ListItem left={<Text className="text-2xl">📚</Text>} title={t('mazeed.myLogs')} onPress={() => router.push('/log/history')} />
      <ListItem left={<Text className="text-2xl">🔔</Text>} title={t('mazeed.notifications')} right={unread ? <StatusChip tone="danger" label={String(unread)} /> : undefined} onPress={() => router.push('/notifications')} />
      <ListItem
        testID="open-problems"
        left={<Text className="text-2xl">⚠️</Text>}
        title={t('sync.problemsTitle')}
        right={s.problems ? <StatusChip tone="danger" label={String(s.problems)} /> : <StatusChip tone="success" label="0" />}
        onPress={() => router.push('/sync-problems')}
      />

      <View className="gap-2 rounded-card border border-border bg-card p-4">
        <Text className="font-semibold text-base text-ink">{t('sync.statusTitle')}</Text>
        <Text className="text-sm text-muted">
          {t('sync.pendingUploads')}: {s.pending + s.pendingUploads}
        </Text>
        <Text className="text-sm text-muted">{s.lastPullAt ? t('sync.lastSync', { when: formatDistanceToNowStrict(s.lastPullAt) }) : t('sync.never')}</Text>
        {s.lastError && s.phase !== 'idle' ? <Text className="text-xs text-danger">{s.lastError}</Text> : null}
        <BigButton small variant="secondary" icon="⟳" label={t('sync.syncNow')} loading={s.phase === 'syncing'} onPress={() => void syncFromApp()} />
      </View>

      <View className="gap-2 rounded-card border border-border bg-card p-4">
        <Text className="font-semibold text-base text-ink">{t('mazeed.language')}</Text>
        <View className="flex-row gap-2">
          {LANGS.map((l) => (
            <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ selected: language === l.id }} onPress={() => void setLanguage(l.id)} className={`min-h-12 flex-1 items-center justify-center rounded-card border ${language === l.id ? 'border-primary bg-primary-soft' : 'border-border'}`}>
              <Text className={language === l.id ? 'font-semibold text-primary' : 'text-ink'}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-1 rounded-card border border-border bg-card p-4">
        <Text className="font-semibold text-base text-ink">{t('mazeed.profile')}</Text>
        <Text className="text-ink">{user.name}</Text>
        <Text className="text-sm text-muted">
          {displayPhone(user.phone)} · {user.role}
        </Text>
        <Text className="text-sm text-muted">{user.tenantName}</Text>
        <Text className="text-xs text-neutral">v{APP_VERSION}</Text>
      </View>

      <BigButton testID="logout" variant="secondary" icon="🚪" label={t('auth.logout')} loading={busy} onPress={() => void doLogout(false)} />

      <ConfirmSheet
        visible={!!confirm}
        danger
        title={t('auth.logoutConfirm')}
        body={confirm ? t('auth.logoutPending', { n: confirm.pending }) : undefined}
        confirmLabel={t('auth.logoutAnyway')}
        loading={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void doLogout(true);
        }}
      />
    </Screen>
  );
}
