import { formatDistanceToNowStrict } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useT } from '@/i18n';
import { syncFromApp } from '@/sync/triggers';
import { useSyncStatus } from '@/sync/useSyncStatus';

/**
 * One line under the header: offline · N waiting · problems · all synced.
 * Tap → "Sync problems" when there are any, otherwise sync now.
 */
export function SyncBanner() {
  const t = useT();
  const s = useSyncStatus();
  const waiting = s.pending + s.pendingUploads;
  let box = 'bg-success-soft';
  let text = 'text-success';
  let label = t('sync.allSynced');
  if (s.problems > 0) {
    box = 'bg-danger-soft';
    text = 'text-danger';
    label = `⚠️ ${t('sync.problems', { n: s.problems })}`;
  } else if (s.phase === 'syncing') {
    box = 'bg-primary-soft';
    text = 'text-primary';
    label = `⟳ ${t('sync.syncing')}`;
  } else if (s.phase === 'offline') {
    box = 'bg-accent-soft';
    text = 'text-warning';
    label = `📴 ${t('sync.offline')}${waiting ? ` · ${t('sync.waiting', { n: waiting })}` : ''}`;
  } else if (waiting > 0) {
    box = 'bg-accent-soft';
    text = 'text-warning';
    label = `⏳ ${t('sync.waiting', { n: waiting })}`;
  } else if (s.lastPullAt) {
    label = `✓ ${t('sync.allSynced')} · ${t('sync.lastSync', { when: formatDistanceToNowStrict(s.lastPullAt) })}`;
  }
  return (
    <Pressable
      testID="sync-banner"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => (s.problems > 0 ? router.push('/sync-problems') : void syncFromApp())}
      className={`min-h-12 flex-row items-center px-4 ${box}`}
    >
      <Text className={`font-medium text-sm ${text}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
