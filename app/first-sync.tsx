import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@components/BigButton';
import { Icon } from '@components/Icon';
import { NetworkError } from '@/api/client';
import { useSession } from '@/features/session';
import { errorText, useI18n } from '@/i18n';
import { CARD_SHADOW, COLORS, RAISED_SHADOW } from '@/lib/theme';

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
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand" style={RAISED_SHADOW}>
          <Icon name="crane" size={44} color={COLORS.accent} />
        </View>
        <Text className="text-center font-bold text-2xl text-ink">{user ? t('aaj.greeting', { name: user.name }) : ''}</Text>
        {busy ? (
          <View className="w-full items-center gap-3 rounded-card bg-card p-6" style={CARD_SHADOW}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text className="text-center font-semibold text-lg text-ink">{t('auth.firstSync')}</Text>
            <Text className="text-center text-base text-muted">{t('auth.firstSyncHint')}</Text>
          </View>
        ) : error ? (
          <View className="w-full gap-3">
            <View className="flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-3">
              <Icon name="wifi-off" size={20} color={COLORS.danger} />
              <Text className="flex-1 text-base text-danger">{error}</Text>
            </View>
            <BigButton label={t('common.retry')} onPress={() => void run()} />
            <BigButton variant="ghost" label={t('auth.logout')} onPress={() => void logout(true)} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
