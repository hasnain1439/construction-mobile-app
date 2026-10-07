import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { Screen } from '@components/Screen';
import { verifyOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useSession } from '@/features/session';
import { errorText, useI18n } from '@/i18n';

/** The phone number belongs to more than one company: the same code signs into the chosen one. */
export default function SelectCompanyScreen() {
  const { t, language } = useI18n();
  const { signedIn } = useSession();
  const { phone, code, companies } = useLocalSearchParams<{ phone: string; code: string; companies: string }>();
  const list = JSON.parse(companies || '[]') as Company[];
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (c: Company) => {
    setBusy(c.tenantId);
    setError(null);
    try {
      signedIn(await verifyOtp(phone, code, c.tenantId));
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
