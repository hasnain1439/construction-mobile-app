import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@components/Icon';
import { usePermissions } from '@/features/access';
import { useT } from '@/i18n';
import { TAB_PERMS } from '@/lib/permissions';
import { COLORS } from '@/lib/theme';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { OFFICE_TAB_KEYS } from '@/features/office';

const icon = (active: string, idle: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View className={`h-8 w-12 items-center justify-center rounded-full ${focused ? 'bg-primary' : ''}`}>
        <Icon name={focused ? active : idle} size={22} color={focused ? COLORS.white : COLORS.muted} />
      </View>
    );
  };

export default function TabsLayout() {
  const t = useT();
  const s = useSyncStatus();
  const p = usePermissions();
  // Clear of the phone's gesture bar / buttons: the bar grows by the bottom inset.
  const insets = useSafeAreaInsets();
  // href: null hides a tab the person can't use (the server refuses it anyway).
  const tab = (keys: readonly string[]) => (p.canAny(...keys) ? {} : { href: null });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.ink,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: { height: 64 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), borderTopColor: COLORS.border, backgroundColor: COLORS.card },
        tabBarLabelStyle: { fontFamily: 'Cabin_600SemiBold', fontSize: 10, marginTop: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="aaj" options={{ title: t('tabs.aaj'), tabBarIcon: icon('home-variant', 'home-variant-outline') }} />
      <Tabs.Screen name="hazri" options={{ ...tab(TAB_PERMS.hazri), title: t('tabs.hazri'), tabBarIcon: icon('account-hard-hat', 'account-hard-hat-outline') }} />
      <Tabs.Screen name="maal" options={{ ...tab(TAB_PERMS.maal), title: t('tabs.maal'), tabBarIcon: icon('wall', 'wall') }} />
      <Tabs.Screen name="kharcha" options={{ ...tab(TAB_PERMS.kharcha), title: t('tabs.kharcha'), tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="office" options={{ ...tab(OFFICE_TAB_KEYS), title: t('tabs.office'), tabBarIcon: icon('briefcase-variant', 'briefcase-variant-outline') }} />
      <Tabs.Screen
        name="mazeed"
        options={{ title: t('tabs.mazeed'), tabBarIcon: icon('dots-horizontal-circle', 'dots-horizontal-circle-outline'), tabBarBadge: s.problems > 0 ? s.problems : undefined }}
      />
    </Tabs>
  );
}
