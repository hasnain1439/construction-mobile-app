import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { ChoiceChips } from '@components/ChoiceChips';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { IconBadge } from '@components/IconBadge';
import { PhotoPicker } from '@components/PhotoPicker';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { checkLoss, EQUIPMENT_ICON, reportEquipmentLoss, siteEquipment } from '@/features/equipment';
import { useProject } from '@/features/project';
import type { EquipmentLossKind } from '@/features/types';
import { useSave } from '@/features/useSave';
import { errorText, useI18n } from '@/i18n';
import { qty } from '@/lib/qty';
import { COLORS } from '@/lib/theme';

/** "Gum / toota saaman": which item on site, missing or damaged, how many, what happened, a photo. */
export default function EquipmentLossScreen() {
  const { t, f, language } = useI18n();
  const save = useSave();
  const { projectId, project } = useProject();
  const onSite = useQuery((db) => (projectId ? siteEquipment(db, projectId) : []), [projectId]);
  const [lineId, setLineId] = useState<string | null>(null);
  const [kind, setKind] = useState<EquipmentLossKind>('MISSING');
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  if (!projectId) return null;
  const line = onSite.find((s) => s.id === lineId) ?? null;
  const n = count === '' ? Number.NaN : Number(count);
  const error = line ? checkLoss({ kind, qty: n, note, photoId: photos[0] ?? null }, line.quantity) : null;

  const submit = () => {
    if (!line || error) return;
    save((db, c) => reportEquipmentLoss(db, c, { projectId, equipmentId: line.equipmentId, rentalId: line.rentalId, kind, qty: n, note, photoId: photos[0] ?? null }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('eq.reportLoss')} subtitle={project?.name} />} refresh={false} footer={<BigButton testID="save-eq-loss" label={t('common.save')} disabled={!line || !!error} onPress={submit} />}>
      <Text className="font-semibold text-sm text-ink">{t('eq.which')}</Text>
      {!onSite.length ? <EmptyState icon="crane" title={t('eq.empty')} /> : null}
      {onSite.map((s) => {
        const on = s.id === lineId;
        return (
          <Pressable
            key={s.id}
            testID={`loss-item-${s.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => setLineId(s.id)}
            className={`min-h-14 flex-row items-center gap-3 rounded-xl border px-3 py-2 ${on ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
          >
            <IconBadge name={EQUIPMENT_ICON[s.equipment?.category ?? 'OTHER']} tone={s.rentalId ? 'violet' : 'accent'} size={36} />
            <View className="flex-1">
              <Text className={on ? 'font-semibold text-primary' : 'font-semibold text-ink'}>{s.equipment?.name ?? '—'}</Text>
              <Text className="text-xs text-muted">{[s.rentalId ? t('eq.rentedShort') : t('eq.owned'), t('eq.onSiteQty', { qty: `${qty(s.quantity)} ${f.unit(s.equipment?.unit)}` })].join(' · ')}</Text>
            </View>
          </Pressable>
        );
      })}
      {line ? (
        <>
          <ChoiceChips<EquipmentLossKind>
            testIDPrefix="loss-kind"
            options={[
              { id: 'MISSING', label: t('losskind.MISSING'), icon: 'help-circle-outline' },
              { id: 'DAMAGED', label: t('losskind.DAMAGED'), icon: 'hammer-wrench' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <QuantityInput testID="loss-qty" label={t('common.quantity')} value={count} unit={line.equipment?.unit} onChange={setCount} />
          <TextInput
            testID="loss-note"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder={t('eq.lossNote')}
            placeholderTextColor={COLORS.neutral}
            className="min-h-20 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            textAlignVertical="top"
          />
          {kind === 'DAMAGED' ? <Text className="text-sm text-muted">{t('eq.photoDamaged')}</Text> : null}
          <PhotoPicker kind="SITE_PHOTO" value={photos} onChange={setPhotos} max={1} required={kind === 'DAMAGED'} />
          {error && count !== '' ? <Text className="text-sm text-danger">{errorText(language, error)}</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}
