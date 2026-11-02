import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@components/BigButton';
import { BrandLogo } from '@components/BrandLogo';
import { BuildingHero } from '@components/BuildingHero';
import { Icon } from '@components/Icon';
import { passwordLogin, requestOtp, type Company } from '@/api/auth';
import { ApiError } from '@/api/client';
import { setPendingLogin } from '@/features/pendingLogin';
import { useSession } from '@/features/session';
import { errorText, LANGUAGE_NAMES, useI18n } from '@/i18n';
import { loginIdentifier } from '@/lib/loginId';
import { normalisePhone } from '@/lib/phone';
import { COLORS, RAISED_SHADOW } from '@/lib/theme';

type Form = { login: string; password: string };
type Mode = 'password' | 'code';

/**
 * Same as the web dashboard's sign-in: email or mobile number + password (default), or a mobile
 * number + SMS code — for site staff without a password.
 */
export default function LoginScreen() {
  const { t, language, setLanguage } = useI18n();
  const { signedIn } = useSession();
  const [mode, setMode] = useState<Mode>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>({ defaultValues: { login: '', password: '' } });

  const submit = handleSubmit(async ({ login, password }) => {
    setError(null);
    setFieldError(null);
    if (mode === 'code') {
      const e164 = normalisePhone(login);
      if (!e164) {
        setFieldError(t('auth.invalidPhone'));
        return;
      }
      try {
        const res = await requestOtp(e164);
        router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(res.resendAfter), ...(res.emailed ? { emailed: '1' } : {}) } });
      } catch (err) {
        setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
      }
      return;
    }
    const id = loginIdentifier(login);
    if (!id) {
      setFieldError(t('auth.invalidLogin'));
      return;
    }
    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }
    try {
      signedIn(await passwordLogin(id, password), 'password');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MULTIPLE_COMPANIES') {
        const companies = (err.details as { companies?: Company[] } | undefined)?.companies ?? [];
        setPendingLogin({ mode: 'password', phone: id, password });
        router.push({ pathname: '/select-company', params: { companies: JSON.stringify(companies) } });
      } else {
        setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
      }
    }
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-brand">
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView className="flex-1" contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          <BuildingHero>
            <View className="items-center gap-3 px-6 pb-14 pt-14">
              <BrandLogo testID="brand-logo" variant="onDark" />
              <Text className="text-center text-base text-white/80">{t('auth.title')}</Text>
            </View>
          </BuildingHero>

          <View className="-mt-6 flex-1 gap-5 rounded-t-[28px] bg-bg px-6 pb-8 pt-7">
            <View className="flex-row rounded-full bg-stone p-1" accessibilityRole="tablist">
              {(['password', 'code'] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`mode-${m}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                    setFieldError(null);
                  }}
                  className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full ${mode === m ? 'bg-primary' : ''}`}
                  style={mode === m ? RAISED_SHADOW : undefined}
                >
                  <Icon name={m === 'code' ? 'message-text-outline' : 'lock-outline'} size={18} color={mode === m ? COLORS.onPrimary : COLORS.muted} />
                  <Text className={mode === m ? 'font-semibold text-on-primary' : 'font-medium text-muted'}>{t(m === 'code' ? 'auth.withCode' : 'auth.withPassword')}</Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-2">
              <Text className="font-semibold text-sm text-ink">{t(mode === 'password' ? 'auth.emailOrPhone' : 'auth.phone')}</Text>
              <Controller
                control={control}
                name="login"
                render={({ field }) => (
                  <View className={`min-h-14 flex-row items-center gap-3 rounded-xl border bg-card px-4 ${fieldError ? 'border-danger' : 'border-border'}`}>
                    <Icon name={mode === 'password' ? 'account-outline' : 'phone-outline'} size={20} color={COLORS.muted} />
                    <TextInput
                      testID="login-input"
                      accessibilityLabel={t(mode === 'password' ? 'auth.emailOrPhone' : 'auth.phone')}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      keyboardType={mode === 'password' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={mode === 'password' ? 'username' : 'tel'}
                      placeholder={t(mode === 'password' ? 'auth.loginHint' : 'auth.phoneHint')}
                      placeholderTextColor={COLORS.neutral}
                      className="min-h-14 flex-1 font-semibold text-lg text-ink"
                      onSubmitEditing={() => void submit()}
                    />
                  </View>
                )}
              />
              {fieldError ? <Text className="text-sm text-danger">{fieldError}</Text> : null}
              {mode === 'password' ? (
                <>
                  <Text className="mt-2 font-semibold text-sm text-ink">{t('auth.password')}</Text>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field }) => (
                      <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-card pl-4">
                        <Icon name="lock-outline" size={20} color={COLORS.muted} />
                        <TextInput
                          testID="password-input"
                          accessibilityLabel={t('auth.password')}
                          value={field.value}
                          onChangeText={field.onChange}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete="password"
                          className="min-h-14 flex-1 text-lg text-ink"
                          onSubmitEditing={() => void submit()}
                        />
                        <Pressable
                          testID="toggle-password"
                          accessibilityRole="button"
                          accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                          onPress={() => setShowPassword((s) => !s)}
                          className="min-h-14 justify-center px-4"
                        >
                          <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.muted} />
                        </Pressable>
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
              {LANGUAGE_NAMES.map((l) => (
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
