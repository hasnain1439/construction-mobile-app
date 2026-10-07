import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useT } from '@/i18n';
import { useSyncStatus } from '@/sync/useSyncStatus';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const t = useT();
  const s = useSyncStatus();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: { minHeight: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
      }}
    >
      <Tabs.Screen name="aaj" options={{ title: t('tabs.aaj'), tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="hazri" options={{ title: t('tabs.hazri'), tabBarIcon: icon('👷') }} />
      <Tabs.Screen name="maal" options={{ title: t('tabs.maal'), tabBarIcon: icon('🧱') }} />
      <Tabs.Screen name="kharcha" options={{ title: t('tabs.kharcha'), tabBarIcon: icon('💵') }} />
      <Tabs.Screen name="mazeed" options={{ title: t('tabs.mazeed'), tabBarIcon: icon('☰'), tabBarBadge: s.problems > 0 ? s.problems : undefined }} />
    </Tabs>
  );
}
