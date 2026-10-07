import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { addWorker } from '@/features/actions';
import { useProject } from '@/features/project';
import { useUser } from '@/features/session';
import { WORKER_TYPES, type WorkerType } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { rupeesToPaisa } from '@/lib/money';
import { can } from '@/lib/permissions';
import { normalisePhone } from '@/lib/phone';

const schema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(['MISTRI', 'MISTRI_TILES', 'MAZDOOR', 'STEEL_FIXER_HELPER', 'CHOWKIDAR', 'OTHER']),
  phone: z.string().refine((v) => !v.trim() || normalisePhone(v) !== null),
  rate: z.string().refine((v) => !v || rupeesToPaisa(v) !== null),
});
type Form = z.infer<typeof schema>;

/** New worker, added to this site at once (works offline; hazri can be marked straight away). */
export default function NewWorkerScreen() {
  const t = useT();
  const save = useSave();
  const user = useUser();
  const { projectId } = useProject();
  const canRate = can.setWorkerRate(user.role);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', type: 'MAZDOOR', phone: '', rate: '' } });

  const submit = handleSubmit((f) => {
    if (!projectId) return;
    const phone = f.phone.trim() ? normalisePhone(f.phone)! : undefined;
    const rate = canRate && f.rate ? rupeesToPaisa(f.rate)! : undefined;
    save((db, c) => addWorker(db, c, { projectId, name: f.name.trim(), type: f.type as WorkerType, phone, dailyRatePaisa: rate }));
    router.back();
  });

  return (
    <Screen header={<Header back title={t('hazri.addWorker')} />} refresh={false} footer={<BigButton testID="save-worker" label={t('common.save')} onPress={() => void submit()} />}>
      <View className="gap-1">
        <Text className="font-medium text-sm text-muted">{t('hazri.workerName')}</Text>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput testID="worker-name" value={field.value} onChangeText={field.onChange} autoCapitalize="words" className={`min-h-14 rounded-card border bg-card px-4 text-lg text-ink ${errors.name ? 'border-danger' : 'border-border'}`} />
          )}
        />
        {errors.name ? <Text className="text-sm text-danger">{t('common.required')}</Text> : null}
      </View>
      <View className="gap-2">
        <Text className="font-medium text-sm text-muted">{t('hazri.workerType')}</Text>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <View className="flex-row flex-wrap gap-2">
              {WORKER_TYPES.map((wt) => (
                <Pressable key={wt} accessibilityRole="radio" accessibilityState={{ selected: field.value === wt }} onPress={() => field.onChange(wt)} className={`min-h-12 justify-center rounded-full border px-4 ${field.value === wt ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}>
                  <Text className={field.value === wt ? 'font-semibold text-primary' : 'text-ink'}>{t(`wtype.${wt}` as never)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </View>
      <View className="gap-1">
        <Text className="font-medium text-sm text-muted">
          {t('hazri.workerPhone')} ({t('common.optional')})
        </Text>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" placeholder={t('auth.phoneHint')} placeholderTextColor="#94A3B8" className={`min-h-14 rounded-card border bg-card px-4 text-lg text-ink ${errors.phone ? 'border-danger' : 'border-border'}`} />
          )}
        />
        {errors.phone ? <Text className="text-sm text-danger">{t('auth.invalidPhone')}</Text> : null}
      </View>
      {canRate ? (
        <Controller control={control} name="rate" render={({ field }) => <QuantityInput money label={`${t('hazri.dailyRate')} (${t('common.optional')})`} value={field.value} onChange={field.onChange} error={errors.rate ? t('common.required') : null} />} />
      ) : (
        <Text className="text-sm text-muted">ℹ️ {t('hazri.defaultRate')}</Text>
      )}
    </Screen>
  );
}
