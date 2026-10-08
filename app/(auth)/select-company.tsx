import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { Screen } from '@components/Screen';
import { passwordLogin, verifyOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { clearPendingLogin, takePendingLogin } from '@/features/pendingLogin';
import { useSession } from '@/features/session';
import { errorText, useI18n } from '@/i18n';

/** The phone number belongs to more than one company: the same code (or password) signs into the chosen one. */
export default function SelectCompanyScreen() {
  const { t, language } = useI18n();
  const { signedIn } = useSession();
  const { companies } = useLocalSearchParams<{ companies: string }>();
  const list = JSON.parse(companies || '[]') as Company[];
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (c: Company) => {
    setBusy(c.tenantId);
    setError(null);
    try {
      const pending = takePendingLogin();
      if (!pending) {
        router.replace('/login');
        return;
      }
      const user = pending.mode === 'code' ? await verifyOtp(pending.phone, pending.code, c.tenantId) : await passwordLogin(pending.phone, pending.password, c.tenantId);
      clearPendingLogin();
      signedIn(user);
    } catch (err) {
      setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen banner={false} refresh={false} header={<Header back title={t('auth.chooseCompany')} />}>
      {list.map((c) => (
        <ListItem key={c.tenantId} title={c.name} subtitle={busy === c.tenantId ? t('common.loading') : c.role} onPress={() => void choose(c)} right={<Text className="text-xl text-muted">›</Text>} />
      ))}
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </Screen>
  );
}
