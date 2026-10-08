import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { IconBadge } from '@components/IconBadge';
import { requestOtp, verifyOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { setPendingLogin } from '@/features/pendingLogin';
import { useSession } from '@/features/session';
import { errorText, useI18n } from '@/i18n';
import { displayPhone } from '@/lib/phone';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

const LENGTH = 6;

export default function OtpScreen() {
  const { t, language } = useI18n();
  const { signedIn, config } = useSession();
  const params = useLocalSearchParams<{ phone: string; resendAfter?: string; emailed?: string }>();
  const phone = params.phone;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(Number(params.resendAfter ?? config?.otpResendSeconds ?? 60));

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const verify = async (value: string) => {
    if (value.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      signedIn(await verifyOtp(phone, value));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MULTIPLE_COMPANIES') {
        const companies = (err.details as { companies?: Company[] } | undefined)?.companies ?? [];
        setPendingLogin({ mode: 'code', phone, code: value });
        router.push({ pathname: '/select-company', params: { companies: JSON.stringify(companies) } });
      } else {
        setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
        setCode('');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const res = await requestOtp(phone);
      setWait(res.resendAfter);
    } catch (err) {
      setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Header back title={t('auth.otpTitle')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 gap-5 p-6">
        <View className="flex-row items-center gap-3 rounded-card bg-card p-4" style={CARD_SHADOW}>
          <IconBadge name="message-text-outline" tone="primary" />
          <View className="flex-1 gap-1">
            <Text className="text-base text-ink">{t('auth.otpSent', { phone: displayPhone(phone) })}</Text>
            {params.emailed ? <Text className="text-sm text-muted">{t('auth.otpEmailed')}</Text> : null}
          </View>
        </View>
        <TextInput
          testID="otp-input"
          accessibilityLabel={t('auth.otpTitle')}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, LENGTH);
            setCode(digits);
            if (digits.length === LENGTH) void verify(digits);
          }}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus
          maxLength={LENGTH}
          className="min-h-16 rounded-xl border border-border bg-card text-center font-bold text-3xl tracking-[12px] text-ink"
        />
        {error ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-2">
            <Icon name="alert-circle-outline" size={18} color={COLORS.danger} />
            <Text className="flex-1 text-sm text-danger">{error}</Text>
          </View>
        ) : null}
        <BigButton testID="verify" label={t('auth.verify')} loading={busy} disabled={code.length !== LENGTH} onPress={() => void verify(code)} />
        <View className="items-center">
          {wait > 0 ? (
            <View className="flex-row items-center gap-1">
              <Icon name="timer-outline" size={16} color={COLORS.muted} />
              <Text className="text-muted">{t('auth.resendIn', { s: wait })}</Text>
            </View>
          ) : (
            <BigButton variant="ghost" small label={t('auth.resend')} onPress={() => void resend()} />
          )}
          <Text className="mt-3 text-center text-sm text-muted">{t('auth.noCodeHint')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
