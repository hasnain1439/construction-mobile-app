import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@components/Icon';
import { useT } from '@/i18n';
import { COLORS } from '@/lib/theme';
import { useSyncStatus } from '@/sync/useSyncStatus';

const icon = (active: string, idle: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View className={`h-8 w-14 items-center justify-center rounded-full ${focused ? 'bg-primary-soft' : ''}`}>
        <Icon name={focused ? active : idle} size={22} color={focused ? COLORS.primary : COLORS.muted} />
      </View>
    );
  };

export default function TabsLayout() {
  const t = useT();
  const s = useSyncStatus();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: { minHeight: 68, paddingTop: 8, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 2 },
        tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="aaj" options={{ title: t('tabs.aaj'), tabBarIcon: icon('home-variant', 'home-variant-outline') }} />
      <Tabs.Screen name="hazri" options={{ title: t('tabs.hazri'), tabBarIcon: icon('account-hard-hat', 'account-hard-hat-outline') }} />
      <Tabs.Screen name="maal" options={{ title: t('tabs.maal'), tabBarIcon: icon('wall', 'wall') }} />
      <Tabs.Screen name="kharcha" options={{ title: t('tabs.kharcha'), tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen
        name="mazeed"
        options={{ title: t('tabs.mazeed'), tabBarIcon: icon('dots-horizontal-circle', 'dots-horizontal-circle-outline'), tabBarBadge: s.problems > 0 ? s.problems : undefined }}
      />
    </Tabs>
  );
}
