import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { passwordLogin, requestOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { setPendingLogin } from '@/features/pendingLogin';
import { useSession } from '@/features/session';
import { errorText, useI18n, type Language } from '@/i18n';
import { normalisePhone } from '@/lib/phone';

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
        router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(res.resendAfter) } });
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
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center gap-6 p-6">
        <View className="items-center gap-2">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary">
            <Text className="text-4xl">🏗️</Text>
          </View>
          <Text className="font-bold text-3xl text-ink">{t('app.name')}</Text>
          <Text className="text-center text-base text-muted">{t('auth.title')}</Text>
        </View>

        <View className="flex-row rounded-card border border-border bg-card p-1" accessibilityRole="tablist">
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
              className={`min-h-12 flex-1 items-center justify-center rounded-card ${mode === m ? 'bg-primary' : ''}`}
            >
              <Text className={mode === m ? 'font-semibold text-white' : 'text-muted'}>{t(m === 'code' ? 'auth.withCode' : 'auth.withPassword')}</Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-2">
          <Text className="font-medium text-sm text-muted">{t('auth.phone')}</Text>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextInput
                testID="phone-input"
                accessibilityLabel={t('auth.phone')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder={t('auth.phoneHint')}
                placeholderTextColor="#94A3B8"
                className={`min-h-14 rounded-card border bg-card px-4 font-semibold text-xl text-ink ${errors.phone ? 'border-danger' : 'border-border'}`}
                onSubmitEditing={() => void submit()}
              />
            )}
          />
          {errors.phone ? <Text className="text-sm text-danger">{t('auth.invalidPhone')}</Text> : null}
          {mode === 'password' ? (
            <>
              <Text className="mt-2 font-medium text-sm text-muted">{t('auth.password')}</Text>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <TextInput
                    testID="password-input"
                    accessibilityLabel={t('auth.password')}
                    value={field.value}
                    onChangeText={field.onChange}
                    secureTextEntry
                    autoComplete="password"
                    className="min-h-14 rounded-card border border-border bg-card px-4 text-xl text-ink"
                    onSubmitEditing={() => void submit()}
                  />
                )}
              />
            </>
          ) : null}
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        </View>
        <BigButton testID="send-code" label={t(mode === 'code' ? 'auth.sendCode' : 'auth.signIn')} loading={isSubmitting} onPress={() => void submit()} />
        <Text className="text-center text-sm text-muted">{t(mode === 'code' ? 'auth.noCodeHint' : 'auth.passwordHint')}</Text>
        <View className="flex-row justify-center gap-2">
          {LANGS.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => void setLanguage(l.id)} className={`min-h-12 justify-center rounded-full px-4 ${language === l.id ? 'bg-primary-soft' : ''}`}>
              <Text className={language === l.id ? 'font-semibold text-primary' : 'text-muted'}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
