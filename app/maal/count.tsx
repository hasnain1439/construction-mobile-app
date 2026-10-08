import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { QuantityInput } from '@components/QuantityInput';
import { Screen } from '@components/Screen';
import { useQuery } from '@/db/live';
import { stockCount, type CountReason } from '@/features/actions';
import { useProject } from '@/features/project';
import { siteLocation, siteStock } from '@/features/queries';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { qty } from '@/lib/qty';
import { CARD_SHADOW } from '@/lib/theme';

const REASONS: CountReason[] = ['HARDENED_IN_RAIN', 'BREAKAGE', 'THEFT_SUSPECTED', 'MEASUREMENT', 'OTHER'];

/** Physical stock count: the system quantity is shown; a difference needs a reason. */
export default function CountScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const data = useQuery((db) => (projectId ? { loc: siteLocation(db, projectId), stock: siteStock(db, projectId) } : null), [projectId]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, CountReason>>({});
  if (!data?.loc) return null;
  const loc = data.loc;

  const entered = data.stock.filter((s) => counts[s.materialId] !== undefined && counts[s.materialId] !== '');
  const diff = (materialId: string, system: number) => Number(counts[materialId]) !== system;
  const missingReason = entered.some((s) => diff(s.materialId, s.quantity) && !reasons[s.materialId]);

  const submit = () => {
    if (!entered.length || missingReason) return;
    save((db, c) => stockCount(db, c, { locationId: loc.id, items: entered.map((s) => ({ materialId: s.materialId, counted: Number(counts[s.materialId]), ...(diff(s.materialId, s.quantity) ? { reason: reasons[s.materialId] } : {}) })) }));
    router.back();
  };

  return (
    <Screen header={<Header back title={t('maal.count')} />} refresh={false} footer={<BigButton label={`${t('common.save')}${entered.length ? ` (${entered.length})` : ''}`} disabled={!entered.length || missingReason} onPress={submit} />}>
      {!data.stock.length ? <EmptyState icon="📦" title={t('common.empty')} /> : null}
      {data.stock.map((s) => (
        <View key={s.id} className="gap-3 rounded-card bg-card p-4" style={CARD_SHADOW}>
          <Text className="font-semibold text-ink">
            {s.material?.name ?? '—'} <Text className="font-normal text-sm text-muted">· {t('maal.systemQty')} {qty(s.quantity)} {s.material?.unit}</Text>
          </Text>
          <QuantityInput label={t('maal.counted')} value={counts[s.materialId] ?? ''} unit={s.material?.unit} onChange={(v) => setCounts((x) => ({ ...x, [s.materialId]: v }))} />
          {counts[s.materialId] && diff(s.materialId, s.quantity) ? (
            <View className="flex-row flex-wrap gap-2">
              {REASONS.map((r) => (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: reasons[s.materialId] === r }} onPress={() => setReasons((x) => ({ ...x, [s.materialId]: r }))} className={`min-h-12 justify-center rounded-full border px-3 ${reasons[s.materialId] === r ? 'border-warning bg-warning-soft' : 'border-border bg-bg'}`}>
                  <Text className={reasons[s.materialId] === r ? 'font-semibold text-warning' : 'text-ink'}>{t(`reason.${r}` as never)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
