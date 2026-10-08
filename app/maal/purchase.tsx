import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { BigButton } from '@components/BigButton';
import { BottomSheet } from '@components/BottomSheet';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { ListItem } from '@components/ListItem';
import { MaterialLines, parsedLines, type Line } from '@components/MaterialLines';
import { PhotoPicker } from '@components/PhotoPicker';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import { sitePurchase } from '@/features/actions';
import { useProject } from '@/features/project';
import type { SupplierRow } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { todayPK } from '@/lib/dates';
import { COLORS } from '@/lib/theme';

/** Material bought at the site on credit: challan + photo + quantities. The office adds the rates. */
export default function SitePurchaseScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const suppliers = useQuery((db) => listRows<SupplierRow>(db, 'suppliers').sort((a, b) => a.name.localeCompare(b.name)), []);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [picking, setPicking] = useState(false);
  const [challanNo, setChallanNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  if (!projectId) return null;
  const items = parsedLines(lines);
  const photo = photos[0];
  const ok = !!supplier && challanNo.trim().length > 0 && !!photo && items.length > 0;

  const submit = () => {
    if (!ok || !supplier || !photo) return;
    save((db, c) => sitePurchase(db, c, { projectId, supplier: { id: supplier.id, name: supplier.name }, challanNo: challanNo.trim(), vehicleNo: vehicleNo.trim() || undefined, date: todayPK(), challanPhotoId: photo, items }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('maal.purchase')} />} refresh={false} footer={<BigButton label={t('common.save')} disabled={!ok} onPress={submit} />}>
      <ListItem title={supplier?.name ?? t('maal.supplier')} subtitle={supplier ? t('maal.supplier') : undefined} icon="🚚" iconTone="info" right={<Icon name="chevron-down" size={22} color={COLORS.neutral} />} onPress={() => setPicking(true)} />
      <TextInput value={challanNo} onChangeText={setChallanNo} placeholder={t('maal.challanNo')} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
      <TextInput value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" placeholder={`${t('maal.vehicleNo')} (${t('common.optional')})`} placeholderTextColor={COLORS.neutral} className="min-h-14 rounded-xl border border-border bg-card px-4 text-base text-ink" />
      <PhotoPicker kind="CHALLAN" label={t('maal.challanPhoto')} required max={1} value={photos} onChange={setPhotos} />
      <MaterialLines value={lines} onChange={setLines} />
      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={t('maal.supplier')}>
        {suppliers.map((s) => (
          <ListItem
            key={s.id}
            title={s.name}
            icon="🚚"
            iconTone="info"
            onPress={() => {
              setSupplier(s);
              setPicking(false);
            }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
