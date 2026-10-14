import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { COLORS } from '@/lib/theme';
import { syncFromApp } from '@/sync/triggers';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { Icon } from './Icon';

/**
 * One line under the header: offline · N waiting · problems · all synced.
 * Tap → "Sync problems" when there are any, otherwise sync now.
 */
export function SyncBanner() {
  const { t, f, rtl } = useI18n();
  const s = useSyncStatus();
  const waiting = s.pending + s.pendingUploads;
  let box = 'bg-success-soft';
  let text = 'text-success';
  let ink: string = COLORS.success;
  let icon = 'cloud-check-outline';
  let label = t('sync.allSynced');
  if (s.problems > 0) {
    box = 'bg-danger-soft';
    text = 'text-danger';
    ink = COLORS.danger;
    icon = 'alert-circle-outline';
    label = t('sync.problems', { n: s.problems });
  } else if (s.phase === 'syncing') {
    box = 'bg-primary-soft';
    text = 'text-primary';
    ink = COLORS.primary;
    icon = 'sync';
    label = t('sync.syncing');
  } else if (s.phase === 'offline') {
    box = 'bg-accent-soft';
    text = 'text-warning';
    ink = COLORS.warning;
    icon = 'wifi-off';
    label = `${t('sync.offline')}${waiting ? ` · ${t('sync.waiting', { n: waiting })}` : ''}`;
  } else if (waiting > 0) {
    box = 'bg-accent-soft';
    text = 'text-warning';
    ink = COLORS.warning;
    icon = 'cloud-upload-outline';
    label = s.uploadsDeferred ? `${t('sync.waiting', { n: waiting })} · ${t('sync.waitingWifi')}` : t('sync.waiting', { n: waiting });
  } else if (s.lastPullAt) {
    label = `${t('sync.allSynced')} · ${t('sync.lastSync', { when: f.timeAgo(s.lastPullAt) })}`;
  }
  return (
    <Pressable
      testID="sync-banner"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => (s.problems > 0 ? router.push('/sync-problems') : void syncFromApp())}
      className={`min-h-10 flex-row items-center gap-2 px-4 py-2 ${box}`}
    >
      <Icon name={icon} size={16} color={ink} />
      <Text className={`flex-1 font-medium text-xs ${text}`} numberOfLines={1}>
        {label}
      </Text>
      {s.problems > 0 ? (
        <View>
          <Icon name={rtl ? 'chevron-left' : 'chevron-right'} size={16} color={ink} />
        </View>
      ) : null}
    </Pressable>
  );
}
