import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BrandLogo } from '@components/BrandLogo';
import { ConfirmSheet } from '@components/ConfirmSheet';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { Icon } from '@components/Icon';
import { APP_VERSION } from '@/api/config';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import { usePermissions } from '@/features/access';
import { useSession, useUser } from '@/features/session';
import type { NotificationRow } from '@/features/types';
import { LANGUAGE_NAMES, roleLabel, useI18n } from '@/i18n';
import { PERM, TAB_PERMS } from '@/lib/permissions';
import { displayPhone } from '@/lib/phone';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { versionLabel } from '@/lib/updates';
import { syncFromApp } from '@/sync/triggers';
import { useWifiOnly } from '@/sync/uploadPolicy';
import { useSyncStatus } from '@/sync/useSyncStatus';

export default function MazeedScreen() {
  const { t, f, language, setLanguage } = useI18n();
  const user = useUser();
  const { logout } = useSession();
  const perms = usePermissions();
  const s = useSyncStatus();
  const unread = useQuery((db) => listRows<NotificationRow>(db, 'notifications').filter((n) => !n.read).length, []);
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wifiOnly, setWifiOnly] = useWifiOnly();

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
      <BrandLogo testID="brand-logo" variant="small" />
      <View className="flex-row items-center gap-4 rounded-card bg-brand-light p-4" style={CARD_SHADOW}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Text className="font-bold text-xl text-brand">{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-bold text-lg text-white">{user.name}</Text>
          <Text className="text-sm text-brand-muted">
            {displayPhone(user.phone)} · {roleLabel(language, user.role, perms.access?.permissionRole)}
          </Text>
          <Text className="text-sm text-brand-muted">{user.tenantName}</Text>
        </View>
      </View>
      {perms.can(PERM.logCreate) ? <ListItem icon="📝" iconTone="violet" title={t('mazeed.dailyLog')} onPress={() => router.push('/log/today')} /> : null}
      {perms.can(PERM.logView) ? <ListItem icon="📚" iconTone="info" title={t('mazeed.myLogs')} onPress={() => router.push('/log/history')} /> : null}
      {perms.canAny(...TAB_PERMS.site) ? <Text className="mt-2 font-bold text-lg text-ink">{t('site.title')}</Text> : null}
      {perms.can(PERM.planView) ? <ListItem testID="open-milestones" icon="chart-gantt" iconTone="primary" title={t('site.progress')} onPress={() => router.push('/site/milestones')} /> : null}
      {perms.canAny(PERM.planView, PERM.stoppageCreate) ? <ListItem testID="open-stoppages" icon="weather-pouring" iconTone="warning" title={t('stop.list')} onPress={() => router.push('/site/stoppages')} /> : null}
      {perms.canAny(PERM.instructionCreate, PERM.instructionView) ? <ListItem testID="open-instructions" icon="message-draw" iconTone="info" title={t('si.title')} onPress={() => router.push('/site/instructions')} /> : null}
      {perms.can(PERM.snagView) ? <ListItem testID="open-snags" icon="map-marker-alert-outline" iconTone="danger" title={t('snag.title')} onPress={() => router.push('/site/snags')} /> : null}
      {perms.can(PERM.drawingView) ? <ListItem testID="open-drawings" icon="floor-plan" iconTone="violet" title={t('dwg.title')} onPress={() => router.push('/site/drawings')} /> : null}
      {perms.can(PERM.equipmentView) ? <ListItem testID="open-equipment-more" icon="crane" iconTone="accent" title={t('eq.title')} onPress={() => router.push('/maal/equipment')} /> : null}
      <ListItem icon="🔔" iconTone="accent" title={t('mazeed.notifications')} right={unread ? <StatusChip tone="danger" label={String(unread)} /> : undefined} onPress={() => router.push('/notifications')} />
      <ListItem
        testID="open-problems"
        icon="⚠️"
        iconTone={s.problems ? 'danger' : 'success'}
        title={t('sync.problemsTitle')}
        right={s.problems ? <StatusChip tone="danger" label={String(s.problems)} /> : <StatusChip tone="success" label="0" />}
        onPress={() => router.push('/sync-problems')}
      />

      <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
        <View className="flex-row items-center gap-2">
          <Icon name="cloud-sync-outline" size={20} color={COLORS.primary} />
          <Text className="font-bold text-base text-ink">{t('sync.statusTitle')}</Text>
        </View>
        <Text className="text-sm text-muted">
          {t('sync.pendingUploads')}: {s.pending + s.pendingUploads}
        </Text>
        <Text className="text-sm text-muted">{s.lastPullAt ? t('sync.lastSync', { when: f.timeAgo(s.lastPullAt) }) : t('sync.never')}</Text>
        {s.uploadsDeferred ? <Text className="text-xs text-warning">{t('sync.waitingWifi')}</Text> : null}
        {s.lastError && s.phase !== 'idle' ? <Text className="text-xs text-danger">{s.phase === 'offline' ? t('sync.offline') : t('sync.failed')}</Text> : null}
        <BigButton small variant="secondary" icon="⟳" label={t('sync.syncNow')} loading={s.phase === 'syncing'} onPress={() => void syncFromApp()} />
      </View>

      <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
        <View className="flex-row items-center gap-2">
          <Icon name="wifi" size={20} color={COLORS.primary} />
          <Text className="flex-1 font-bold text-base text-ink">{t('mazeed.wifiOnly')}</Text>
          <Switch
            testID="wifi-only"
            accessibilityLabel={t('mazeed.wifiOnly')}
            value={wifiOnly}
            onValueChange={(on) => {
              setWifiOnly(on);
              // Turned off: send the photos that were waiting.
              if (!on) void syncFromApp();
            }}
            trackColor={{ true: COLORS.primary, false: COLORS.neutral }}
            thumbColor={COLORS.white}
          />
        </View>
        <Text className="text-sm text-muted">{t('mazeed.wifiOnlyHint')}</Text>
      </View>

      <View className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
        <View className="flex-row items-center gap-2">
          <Icon name="translate" size={20} color={COLORS.primary} />
          <Text className="font-bold text-base text-ink">{t('mazeed.language')}</Text>
        </View>
        <View className="flex-row gap-2">
          {LANGUAGE_NAMES.map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === l.id }}
              onPress={() => void setLanguage(l.id)}
              className={`min-h-12 flex-1 items-center justify-center rounded-xl border ${language === l.id ? 'border-primary bg-primary-soft' : 'border-border'}`}
            >
              <Text className={language === l.id ? 'font-semibold text-primary' : 'text-ink'}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <BigButton testID="logout" variant="secondary" icon="🚪" label={t('auth.logout')} loading={busy} onPress={() => void doLogout(false)} />
      <Text className="text-center text-xs text-neutral">{t('common.version', { v: versionLabel(APP_VERSION) })}</Text>

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
