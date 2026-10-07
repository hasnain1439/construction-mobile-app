import { Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@components/BigButton';
import { APP_VERSION } from '@/api/config';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';

/** Forced update: the server's minimumAppVersion is newer than this build. */
export default function UpdateScreen() {
  const t = useT();
  const { config } = useSession();
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-6xl">⬆️</Text>
        <Text className="text-center font-bold text-2xl text-ink">{t('auth.updateTitle')}</Text>
        <Text className="text-center text-base text-muted">{t('auth.updateBody', { current: APP_VERSION, min: config?.minimumAppVersion ?? '' })}</Text>
        <View className="w-full">
          <BigButton label={t('auth.updateOpen')} onPress={() => void Linking.openURL('market://details?id=pk.construction.munshi').catch(() => undefined)} />
        </View>
      </View>
    </SafeAreaView>
  );
}
