import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { requestTopup } from '@/features/actions';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { rupeesToPaisa } from '@/lib/money';
import { COLORS } from '@/lib/theme';

export default function TopupScreen() {
  const t = useT();
  const save = useSave();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const paisa = rupeesToPaisa(amount);
  return (
    <Screen
      header={<Header back title={t('kharcha.topup')} />}
      refresh={false}
      footer={
        <BigButton
          label={t('common.save')}
          disabled={!paisa}
          onPress={() => {
            if (!paisa) return;
            save((db, c) => requestTopup(db, c, { amountPaisa: paisa, note: note.trim() || undefined }));
            router.back();
          }}
        />
      }
    >
      <QuantityInput money label={t('common.amount')} value={amount} onChange={setAmount} />
      <TextInput value={note} onChangeText={setNote} placeholder={`${t('common.note')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
    </Screen>
  );
}
