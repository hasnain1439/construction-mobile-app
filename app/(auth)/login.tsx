import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { requestOtp } from '@/api/auth';
import { ApiError } from '@/api/client';
import { errorText, useI18n, type Language } from '@/i18n';
import { normalisePhone } from '@/lib/phone';

const schema = z.object({ phone: z.string().refine((v) => normalisePhone(v) !== null, 'auth.invalidPhone') });
type Form = z.infer<typeof schema>;

const LANGS: { id: Language; label: string }[] = [
  { id: 'roman', label: 'Roman Urdu' },
  { id: 'ur', label: 'اردو' },
  { id: 'en', label: 'English' },
];

export default function LoginScreen() {
  const { t, language, setLanguage } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });

  const submit = handleSubmit(async ({ phone }) => {
    setError(null);
    const e164 = normalisePhone(phone)!;
    try {
      const res = await requestOtp(e164);
      router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(res.resendAfter) } });
    } catch (err) {
      setError(err instanceof ApiError ? errorText(language, err.code) : t('err.network'));
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
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        </View>
        <BigButton testID="send-code" label={t('auth.sendCode')} loading={isSubmitting} onPress={() => void submit()} />
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
