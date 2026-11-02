import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { Header } from '@components/Header';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { ApiError, NetworkError } from '@/api/client';
import { deleteOfficeExpense, OFFICE_EXPENSE_CATEGORIES, OFFICE_PAID_VIA, saveOfficeExpense, type OfficeExpenseCategory, type OfficePaidVia } from '@/features/office';
import { errorText, useI18n, type TKey } from '@/i18n';
import { addDays, todayPK } from '@/lib/dates';
import { paisaToRupees, rupeesToPaisa } from '@/lib/money';
import { COLORS } from '@/lib/theme';

const CATEGORY_ICON: Record<OfficeExpenseCategory, string> = {
  RENT: 'home-city-outline',
  UTILITIES: 'flash-outline',
  SALARIES: 'account-cash-outline',
  INTERNET_PHONE: 'wifi',
  STATIONERY: 'pencil-outline',
  VEHICLE: 'car-outline',
  REPAIRS: 'wrench-outline',
  TEA_REFRESHMENTS: 'coffee-outline',
  TAXES_FEES: 'bank-outline',
  OTHER: 'dots-horizontal',
};

interface Params {
  id?: string;
  date?: string;
  category?: string;
  amountPaisa?: string;
  paidVia?: string;
  paidTo?: string;
  description?: string;
  [key: string]: string | undefined;
}

const isCategory = (v: string | undefined): v is OfficeExpenseCategory => (OFFICE_EXPENSE_CATEGORIES as readonly string[]).includes(v ?? '');
const isPaidVia = (v: string | undefined): v is OfficePaidVia => (OFFICE_PAID_VIA as readonly string[]).includes(v ?? '');

/**
 * Add an office expense (rent, bills, salaries — not tied to a site), or change / delete one when
 * opened from the list (`?id=…` with its fields). Online only: saved straight to the server.
 */
export default function OfficeExpenseForm() {
  const { t, f, language } = useI18n();
  const params = useLocalSearchParams<Params>();
  const id = params.id || null;
  const today = todayPK();
  const yesterday = addDays(today, -1);
  const [category, setCategory] = useState<OfficeExpenseCategory>(isCategory(params.category) ? params.category : 'RENT');
  const [amount, setAmount] = useState(paisaToRupees(params.amountPaisa));
  const [date, setDate] = useState(params.date && params.date <= today ? params.date : today);
  const [paidVia, setPaidVia] = useState<OfficePaidVia>(isPaidVia(params.paidVia) ? params.paidVia : 'CASH');
  const [paidTo, setPaidTo] = useState(params.paidTo ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paisa = rupeesToPaisa(amount);
  const descOk = description.trim().length >= 2;
  const dates = [today, yesterday, ...(params.date && params.date < yesterday ? [params.date] : [])];

  const failed = (e: unknown) => setError(e instanceof NetworkError ? t('office.offline') : errorText(language, e instanceof ApiError ? e.code : null));

  const save = async () => {
    setTried(true);
    if (!paisa || !descOk) return;
    setBusy('save');
    setError(null);
    try {
      await saveOfficeExpense(id, { date, category, amountPaisa: paisa, paidVia, paidTo: paidTo.trim() || null, description: description.trim() });
      router.back();
    } catch (e) {
      failed(e);
      setBusy(null);
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert(t('oexp.deleteTitle'), t('oexp.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setBusy('delete');
          setError(null);
          deleteOfficeExpense(id).then(
            () => router.back(),
            (e: unknown) => {
              failed(e);
              setBusy(null);
            },
          );
        },
      },
    ]);
  };

  return (
    <Screen
      refresh={false}
      header={<Header back title={id ? t('oexp.edit') : t('oexp.add')} />}
      footer={
        <View className="gap-2">
          <BigButton testID="oexp-save" label={t('common.save')} loading={busy === 'save'} disabled={busy !== null} onPress={() => void save()} />
          {id ? <BigButton testID="oexp-delete" small variant="ghost" icon="delete-outline" label={t('common.delete')} loading={busy === 'delete'} disabled={busy !== null} onPress={remove} /> : null}
        </View>
      }
    >
      <QuantityInput testID="oexp-amount" money label={t('common.amount')} value={amount} onChange={setAmount} error={tried && !paisa ? t('common.required') : null} />
      <Text className="font-semibold text-sm text-ink">{t('oexp.category')}</Text>
      <ChoiceChips testIDPrefix="oexp-cat" options={OFFICE_EXPENSE_CATEGORIES.map((c) => ({ id: c, label: t(`oexp.cat.${c}` as TKey), icon: CATEGORY_ICON[c] }))} value={category} onChange={setCategory} />
      <Text className="font-semibold text-sm text-ink">{t('oexp.whatFor')}</Text>
      <TextInput
        testID="oexp-description"
        accessibilityLabel={t('oexp.whatFor')}
        value={description}
        onChangeText={setDescription}
        maxLength={300}
        multiline
        placeholder={t('common.description')}
        placeholderTextColor={COLORS.neutral}
        className={`min-h-14 rounded-xl border bg-card px-4 py-3 text-base text-ink ${tried && !descOk ? 'border-danger' : 'border-border'}`}
      />
      {tried && !descOk ? <Text className="text-sm text-danger">{t('oexp.descriptionShort')}</Text> : null}
      <Text className="font-semibold text-sm text-ink">{t('oexp.date')}</Text>
      <ChoiceChips
        testIDPrefix="oexp-date"
        options={dates.map((d) => ({ id: d, label: d === today ? t('common.today') : d === yesterday ? t('oexp.yesterday') : f.shortDate(d), icon: 'calendar' }))}
        value={date}
        onChange={setDate}
      />
      <Text className="font-semibold text-sm text-ink">{t('oexp.paidVia')}</Text>
      <ChoiceChips testIDPrefix="oexp-via" options={OFFICE_PAID_VIA.map((m) => ({ id: m, label: t(`method.${m}` as TKey) }))} value={paidVia} onChange={setPaidVia} />
      <Text className="font-semibold text-sm text-ink">
        {t('oexp.paidTo')} <Text className="font-normal text-muted">({t('common.optional')})</Text>
      </Text>
      <TextInput
        testID="oexp-paid-to"
        accessibilityLabel={t('oexp.paidTo')}
        value={paidTo}
        onChangeText={setPaidTo}
        maxLength={120}
        placeholderTextColor={COLORS.neutral}
        className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink"
      />
      {error ? <Text testID="oexp-error" className="text-sm text-danger">{error}</Text> : null}
    </Screen>
  );
}
