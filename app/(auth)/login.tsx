import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { Icon } from '@components/Icon';
import { passwordLogin, requestOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { setPendingLogin } from '@/features/pendingLogin';
import { useSession } from '@/features/session';
import { errorText, useI18n, type Language } from '@/i18n';
import { normalisePhone } from '@/lib/phone';
import { CARD_SHADOW, COLORS, RAISED_SHADOW } from '@/lib/theme';

const schema = z.object({
  phone: z.string().refine((v) => normalisePhone(v) !== null, 'auth.invalidPhone'),
  password: z.string(),
});
type Form = z.infer<typeof schema>;
type Mode = 'code' | 'password';

const LANGS: { id: Language; label: string }[] = [
  { id: 'roman', label: 'Roman Urdu' },
  { id: 'ur', label: 'اردو' },
  { id: 'en', label: 'English' },
];

/**
 * Phone + SMS code (default), or phone + password — for when the SMS doesn't arrive (the
 * Thekedar can set the munshi's password, or give a one-time code from the web app).
 */
export default function LoginScreen() {
  const { t, language, setLanguage } = useI18n();
  const { signedIn } = useSession();
  const [mode, setMode] = useState<Mode>('code');
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { phone: '', password: '' } });

  const submit = handleSubmit(async ({ phone, password }) => {
    setError(null);
    const e164 = normalisePhone(phone)!;
    if (mode === 'code') {
      try {
        const res = await requestOtp(e164);
        router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(res.resendAfter), ...(res.emailed ? { emailed: '1' } : {}) } });
      } catch (err) {
        setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
      }
      return;
    }
    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }
    try {
      signedIn(await passwordLogin(e164, password));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MULTIPLE_COMPANIES') {
        const companies = (err.details as { companies?: Company[] } | undefined)?.companies ?? [];
        setPendingLogin({ mode: 'password', phone: e164, password });
        router.push({ pathname: '/select-company', params: { companies: JSON.stringify(companies) } });
      } else {
        setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
      }
    }
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-brand">
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView className="flex-1" contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled">
          <View className="items-center gap-3 px-6 pb-10 pt-12">
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-accent" style={RAISED_SHADOW}>
              <Icon name="crane" size={44} color={COLORS.brand} />
            </View>
            <Text className="font-bold text-3xl text-white">{t('app.name')}</Text>
            <Text className="text-center text-base text-brand-muted">{t('auth.title')}</Text>
          </View>

          <View className="flex-1 gap-5 rounded-t-[28px] bg-bg px-6 pb-8 pt-7">
            <View className="flex-row rounded-xl bg-border p-1" accessibilityRole="tablist">
              {(['code', 'password'] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`mode-${m}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg ${mode === m ? 'bg-card' : ''}`}
                  style={mode === m ? CARD_SHADOW : undefined}
                >
                  <Icon name={m === 'code' ? 'message-text-outline' : 'lock-outline'} size={18} color={mode === m ? COLORS.primary : COLORS.muted} />
                  <Text className={mode === m ? 'font-semibold text-primary' : 'font-medium text-muted'}>{t(m === 'code' ? 'auth.withCode' : 'auth.withPassword')}</Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-2">
              <Text className="font-semibold text-sm text-ink">{t('auth.phone')}</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <View className={`min-h-14 flex-row items-center gap-3 rounded-xl border bg-card px-4 ${errors.phone ? 'border-danger' : 'border-border'}`}>
                    <Icon name="phone-outline" size={20} color={COLORS.muted} />
                    <TextInput
                      testID="phone-input"
                      accessibilityLabel={t('auth.phone')}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      placeholder={t('auth.phoneHint')}
                      placeholderTextColor={COLORS.neutral}
                      className="min-h-14 flex-1 font-semibold text-lg text-ink"
                      onSubmitEditing={() => void submit()}
                    />
                  </View>
                )}
              />
              {errors.phone ? <Text className="text-sm text-danger">{t('auth.invalidPhone')}</Text> : null}
              {mode === 'password' ? (
                <>
                  <Text className="mt-2 font-semibold text-sm text-ink">{t('auth.password')}</Text>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field }) => (
                      <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4">
                        <Icon name="lock-outline" size={20} color={COLORS.muted} />
                        <TextInput
                          testID="password-input"
                          accessibilityLabel={t('auth.password')}
                          value={field.value}
                          onChangeText={field.onChange}
                          secureTextEntry
                          autoComplete="password"
                          className="min-h-14 flex-1 text-lg text-ink"
                          onSubmitEditing={() => void submit()}
                        />
                      </View>
                    )}
                  />
                </>
              ) : null}
              {error ? (
                <View className="flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-2">
                  <Icon name="alert-circle-outline" size={18} color={COLORS.danger} />
                  <Text className="flex-1 text-sm text-danger">{error}</Text>
                </View>
              ) : null}
            </View>
            <BigButton testID="send-code" label={t(mode === 'code' ? 'auth.sendCode' : 'auth.signIn')} loading={isSubmitting} onPress={() => void submit()} />
            <Text className="text-center text-sm text-muted">{t(mode === 'code' ? 'auth.noCodeHint' : 'auth.passwordHint')}</Text>
            <View className="mt-auto flex-row items-center justify-center gap-1">
              <Icon name="translate" size={18} color={COLORS.muted} />
              {LANGS.map((l) => (
                <Pressable key={l.id} accessibilityRole="button" onPress={() => void setLanguage(l.id)} className={`min-h-10 justify-center rounded-full px-3 ${language === l.id ? 'bg-primary-soft' : ''}`}>
                  <Text className={language === l.id ? 'font-semibold text-primary' : 'text-muted'}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
