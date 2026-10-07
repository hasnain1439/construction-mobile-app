import '../global.css';
// Only the four weights the app uses (the package index would bundle all of them).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProjectProvider } from '@/features/project';
import { SessionProvider, useSession } from '@/features/session';
import { I18nProvider } from '@/i18n';
// Importing triggers also defines the background sync task at module scope (expo-task-manager needs that).
import { startSyncTriggers } from '@/sync/triggers';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { status, config, bootError } = useSession();

  useEffect(() => {
    if (status !== 'booting') void SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  // Sync on foreground / reconnect / every 15 min only while signed in and set up.
  useEffect(() => (status === 'ready' ? startSyncTriggers(config?.syncIntervalMinutes ?? 15) : undefined), [status, config]);

  if (bootError) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-bg p-6">
        <Text className="text-4xl">⚠️</Text>
        <Text className="text-center text-base text-ink">{bootError}</Text>
      </View>
    );
  }
  if (status === 'booting') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }
  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F6FA' } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'update'}>
        <Stack.Screen name="update" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'firstSync'}>
        <Stack.Screen name="first-sync" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hazri" />
        <Stack.Screen name="maal" />
        <Stack.Screen name="kharcha" />
        <Stack.Screen name="log" />
        <Stack.Screen name="sync-problems" />
        <Stack.Screen name="notifications" />
      </Stack.Protected>
    </Stack>
  );
  return status === 'ready' ? <ProjectProvider>{stack}</ProjectProvider> : stack;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Gate />
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
