import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@components/BigButton';
import { NetworkError } from '@/api/client';
import { useSession } from '@/features/session';
import { errorText, useI18n } from '@/i18n';

/** First full download after sign-in — needs internet once; afterwards the app works offline. */
export default function FirstSyncScreen() {
  const { t, language } = useI18n();
  const { runFirstSync, user, logout } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const attempt = useCallback(
    () =>
      runFirstSync()
        .catch((err: unknown) => setError(err instanceof NetworkError ? t('err.network') : errorText(language, (err as { code?: string }).code)))
        .finally(() => setBusy(false)),
    [runFirstSync, t, language],
  );

  const run = () => {
    setBusy(true);
    setError(null);
    void attempt();
  };

  // Starts once on arrival (busy is already true).
  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-6xl">🏗️</Text>
        <Text className="text-center font-bold text-2xl text-ink">{user ? t('aaj.greeting', { name: user.name }) : ''}</Text>
        {busy ? (
          <>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-center font-semibold text-lg text-ink">{t('auth.firstSync')}</Text>
            <Text className="text-center text-base text-muted">{t('auth.firstSyncHint')}</Text>
          </>
        ) : error ? (
          <View className="w-full gap-3">
            <Text className="text-center text-base text-danger">{error}</Text>
            <BigButton label={t('common.retry')} onPress={() => void run()} />
            <BigButton variant="ghost" label={t('auth.logout')} onPress={() => void logout(true)} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
