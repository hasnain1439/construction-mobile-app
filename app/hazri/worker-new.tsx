import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { addWorker } from '@/features/actions';
import { useProject } from '@/features/project';
import { usePermissions } from '@/features/access';
import { useSave } from '@/features/useSave';
import { workerTypeOptions, workerTypes, type WorkerTypeOption } from '@/features/workerTypes';
import { useI18n } from '@/i18n';
import { paisaToRupees, rupeesToPaisa } from '@/lib/money';
import { rules, visibleRate } from '@/lib/permissions';
import { normalisePhone } from '@/lib/phone';
import { COLORS } from '@/lib/theme';

const schema = z.object({
  name: z.string().trim().min(2),
  type: z.string().min(1),
  phone: z.string().refine((v) => !v.trim() || normalisePhone(v) !== null),
  rate: z.string().refine((v) => !v || rupeesToPaisa(v) !== null),
});
type Form = z.infer<typeof schema>;

/** New worker, added to this site at once (works offline; hazri can be marked straight away). */
export default function NewWorkerScreen() {
  const { t, language } = useI18n();
  const save = useSave();
  const perms = usePermissions();
  const { projectId } = useProject();
  const canRate = rules.setWorkerRate(perms.access, perms.role);
  const options = useQuery((db) => workerTypeOptions(workerTypes(db), language), [language]);
  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', type: (options.find((o) => o.key === 'MAZDOOR') ?? options[0])!.key, phone: '', rate: '' } });
  // The rate this screen filled in from a type; it may be replaced when another type is chosen,
  // a rate the munshi typed is never touched. Left empty, the server uses the type's rate.
  const filledRate = useRef('');

  const chooseType = (o: WorkerTypeOption) => {
    setValue('type', o.key);
    if (!canRate) return;
    const current = getValues('rate');
    if (current && current !== filledRate.current) return;
    // Without fields.wages the type has no rate (the server leaves it out): nothing is filled.
    filledRate.current = paisaToRupees(visibleRate(perms.access, perms.role, o.ratePaisa));
    setValue('rate', filledRate.current, { shouldValidate: !!errors.rate });
  };

  const submit = handleSubmit((f) => {
    if (!projectId) return;
    const phone = f.phone.trim() ? normalisePhone(f.phone)! : undefined;
    const rate = canRate && f.rate ? rupeesToPaisa(f.rate)! : undefined;
    save((db, c) => addWorker(db, c, { projectId, name: f.name.trim(), type: f.type, phone, dailyRatePaisa: rate }));
    router.back();
  });

  return (
    <Screen header={<Header back title={t('hazri.addWorker')} />} refresh={false} footer={<BigButton testID="save-worker" label={t('common.save')} onPress={() => void submit()} />}>
      <View className="gap-2">
        <Text className="font-semibold text-sm text-ink">{t('hazri.workerName')}</Text>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput testID="worker-name" value={field.value} onChangeText={field.onChange} autoCapitalize="words" className={`min-h-14 rounded-xl border bg-card px-4 text-lg text-ink ${errors.name ? 'border-danger' : 'border-border'}`} />
          )}
        />
        {errors.name ? <Text className="text-sm text-danger">{t('common.required')}</Text> : null}
      </View>
      <View className="gap-2">
        <Text className="font-semibold text-sm text-ink">{t('hazri.workerType')}</Text>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <View className="flex-row flex-wrap gap-2">
              {options.map((o) => (
                <Pressable key={o.key} testID={`worker-type-${o.key}`} accessibilityRole="radio" accessibilityState={{ selected: field.value === o.key }} onPress={() => chooseType(o)} className={`min-h-12 justify-center rounded-full border px-4 ${field.value === o.key ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}>
                  <Text className={field.value === o.key ? 'font-semibold text-primary' : 'text-ink'}>{o.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </View>
      <View className="gap-2">
        <Text className="font-semibold text-sm text-ink">
          {t('hazri.workerPhone')} ({t('common.optional')})
        </Text>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" placeholder={t('auth.phoneHint')} placeholderTextColor={COLORS.neutral} className={`min-h-14 rounded-xl border bg-card px-4 text-lg text-ink ${errors.phone ? 'border-danger' : 'border-border'}`} />
          )}
        />
        {errors.phone ? <Text className="text-sm text-danger">{t('auth.invalidPhone')}</Text> : null}
      </View>
      {canRate ? (
        <Controller control={control} name="rate" render={({ field }) => <QuantityInput money testID="worker-rate" label={`${t('hazri.dailyRate')} (${t('common.optional')})`} value={field.value} onChange={field.onChange} error={errors.rate ? t('common.required') : null} />} />
      ) : (
        <View className="flex-row items-start gap-2 rounded-xl bg-info-soft px-3 py-2">
          <Icon name="information-outline" size={18} color={COLORS.info} />
          <Text className="flex-1 text-sm text-ink">{t('hazri.defaultRate')}</Text>
        </View>
      )}
    </Screen>
  );
}
