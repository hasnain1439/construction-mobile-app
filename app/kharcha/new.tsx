import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { PhotoPicker } from '@components/PhotoPicker';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { addExpense } from '@/features/actions';
import { useProject } from '@/features/project';
import { cashAccount, settings } from '@/features/queries';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT, type TKey } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { formatPKR, rupeesToPaisa, toPaisa } from '@/lib/money';
import { COLORS } from '@/lib/theme';

const ICON: Record<ExpenseCategory, string> = { TEA_WATER: '☕', TRANSPORT: '🛺', UNLOADING: '📦', FUEL: '⛽', SMALL_TOOLS: '🔧', URGENT_MATERIAL: '🧱', OWNER_PURCHASE: '🏠', REPAIRS: '🛠️', OTHER: 'dots-horizontal' };

// URGENT_MATERIAL with goods needs a supplier + items: that is the site purchase screen.
const CATEGORIES = EXPENSE_CATEGORIES;

const schema = z.object({
  category: z.enum(['TEA_WATER', 'TRANSPORT', 'UNLOADING', 'FUEL', 'SMALL_TOOLS', 'URGENT_MATERIAL', 'OWNER_PURCHASE', 'REPAIRS', 'OTHER']),
  amount: z.string().refine((v) => rupeesToPaisa(v) !== null),
  description: z.string().trim().min(2),
  photos: z.array(z.string()).max(1),
});
type Form = z.infer<typeof schema>;

export default function NewKharchaScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const info = useQuery((db) => ({ account: cashAccount(db), limit: settings(db).kharchaApprovalLimitPaisa }), []);
  const {
    control,
    handleSubmit,

    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { category: 'TEA_WATER', amount: '', description: '', photos: [] } });
  const paisa = rupeesToPaisa(useWatch({ control, name: 'amount' }));
  const overLimit = paisa !== null && toPaisa(paisa) > toPaisa(info.limit);
  const notEnough = paisa !== null && !!info.account && toPaisa(info.account.balancePaisa) < toPaisa(paisa);

  const submit = handleSubmit((f) => {
    if (!projectId || notEnough) return;
    save((db, c) => addExpense(db, c, { projectId, category: f.category, amountPaisa: rupeesToPaisa(f.amount)!, description: f.description.trim(), attachmentId: f.photos[0], date: todayPK() }));
    router.back();
  });

  return (
    <Screen header={<Header back title={t('kharcha.add')} />} refresh={false} footer={<BigButton testID="save-kharcha" label={t('common.save')} disabled={notEnough} onPress={() => void submit()} />}>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => <QuantityInput testID="kharcha-amount" money label={t('common.amount')} value={field.value} onChange={field.onChange} error={errors.amount ? t('common.required') : notEnough ? t('err.INSUFFICIENT_CASH') : null} />}
      />
      {info.account ? <Text className="text-sm text-muted">{t('hazri.fromCash', { amount: formatPKR(info.account.balancePaisa) })}</Text> : null}
      {overLimit ? (
        <View className="flex-row items-start gap-2 rounded-xl bg-warning-soft px-3 py-2">
          <Icon name="alert-outline" size={18} color={COLORS.warning} />
          <Text className="flex-1 text-sm text-warning">{t('kharcha.aboveLimit', { limit: formatPKR(info.limit) })}</Text>
        </View>
      ) : null}
      <Text className="font-semibold text-sm text-ink">{t('kharcha.category')}</Text>
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pressable key={c} testID={`cat-${c}`} accessibilityRole="radio" accessibilityState={{ selected: field.value === c }} onPress={() => field.onChange(c)} className={`min-h-12 flex-row items-center gap-1 rounded-full border px-4 ${field.value === c ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}>
                <Icon name={ICON[c]} size={18} color={field.value === c ? COLORS.primary : COLORS.muted} />
                <Text className={field.value === c ? 'font-semibold text-primary' : 'text-ink'}>{t(`cat.${c}` as TKey)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput testID="kharcha-description" value={field.value} onChangeText={field.onChange} placeholder={t('common.description')} placeholderTextColor={COLORS.neutral} className={`min-h-14 rounded-xl border bg-card px-4 text-base text-ink ${errors.description ? 'border-danger' : 'border-border'}`} />
        )}
      />
      <Controller control={control} name="photos" render={({ field }) => <PhotoPicker kind="RECEIPT" label={t('kharcha.slip')} max={1} value={field.value} onChange={field.onChange} />} />
    </Screen>
  );
}
