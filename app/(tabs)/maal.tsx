import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { IconBadge } from '@components/IconBadge';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import { useProject } from '@/features/project';
import { equipmentMap, incomingEquipment } from '@/features/equipment';
import { incomingDispatches, incomingPurchases, siteStock } from '@/features/queries';
import { useI18n } from '@/i18n';
import { PERM } from '@/lib/permissions';
import { qty } from '@/lib/qty';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

/** One list row, memoised so FlashList recycling and unrelated state changes don't re-render every row. */
const StockItem = memo(function StockItem({ item }: { item: ReturnType<typeof siteStock>[number] }) {
  const { t, f } = useI18n();
  return (
    <View className="mx-4 mb-2 min-h-16 flex-row items-center gap-3 rounded-card bg-card px-4 py-3" style={CARD_SHADOW}>
      <IconBadge name="🧱" tone="accent" size={40} />
      <View className="flex-1">
        <Text className="font-semibold text-ink">{item.material?.name ?? '—'}</Text>
        {item.ownerQuantity ? <Text className="text-xs text-muted">{t('maal.ownerQty', { qty: qty(item.ownerQuantity) })}</Text> : null}
      </View>
      <Text className="font-bold text-lg text-ink">
        {qty(item.quantity)} <Text className="text-sm text-muted">{f.unit(item.material?.unit)}</Text>
      </Text>
    </View>
  );
});

/** Material: deliveries on the way, quick entries, site stock. */
export default function MaalScreen() {
  const { t, f } = useI18n();
  const { projectId } = useProject();
  const perms = usePermissions();
  const canReceive = perms.can(PERM.receive);
  const canReceiveEq = perms.can(PERM.equipmentReceive);
  const seesEq = perms.can(PERM.equipmentView);
  const data = useQuery(
    (db) =>
      projectId
        ? { dispatches: incomingDispatches(db, projectId), purchases: incomingPurchases(db, projectId), stock: siteStock(db, projectId), equipment: seesEq || canReceiveEq ? incomingEquipment(db, projectId) : [], eq: equipmentMap(db) }
        : null,
    [projectId, seesEq, canReceiveEq],
  );
  const header = <Header title={t('maal.title')} right={<ProjectSwitcher />} />;
  if (!projectId || !data) {
    return (
      <Screen header={header}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const top = (
    <View className="gap-3 p-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {perms.can(PERM.usageCreate) ? <BigButton small variant="secondary" icon="🧱" label={t('maal.usage')} onPress={() => router.push('/maal/usage')} /> : null}
        {perms.can(PERM.ownerDeliveryCreate) ? <BigButton small variant="secondary" icon="📦" label={t('maal.ownerDelivery')} onPress={() => router.push('/maal/owner-delivery')} /> : null}
        {perms.can(PERM.purchaseCreate) ? <BigButton small variant="secondary" icon="🛒" label={t('maal.purchase')} onPress={() => router.push('/maal/purchase')} /> : null}
        {perms.can(PERM.countCreate) ? <BigButton small variant="secondary" icon="🔢" label={t('maal.count')} onPress={() => router.push('/maal/count')} /> : null}
        {seesEq ? <BigButton testID="open-equipment" small variant="secondary" icon="crane" label={t('eq.title')} onPress={() => router.push('/maal/equipment')} /> : null}
        {perms.can(PERM.equipmentLoss) ? <BigButton small variant="secondary" icon="alert-octagon-outline" label={t('eq.reportLoss')} onPress={() => router.push('/maal/equipment-loss')} /> : null}
      </ScrollView>
      <View className="mt-1 flex-row items-center gap-2">
        <Icon name="truck-delivery-outline" size={20} color={COLORS.info} />
        <Text className="font-bold text-lg text-ink">{t('maal.incoming')}</Text>
      </View>
      {!data.dispatches.length && !data.purchases.length && !data.equipment.length ? (
        <View className="rounded-card border border-dashed border-border bg-card px-4 py-3">
          <Text className="text-sm text-muted">{t('maal.noIncoming')}</Text>
        </View>
      ) : null}
      {data.dispatches.map((d) => (
        <ListItem
          key={d.id}
          testID={`incoming-${d.number}`}
          icon="🚚"
          iconTone="info"
          title={`${d.number} · ${d.from}`}
          subtitle={[d.vehicleNo, d.driverName, f.dateTime(d.dispatchedAt)].filter(Boolean).join(' · ')}
          right={canReceive ? <StatusChip tone="primary" label={t('maal.receive')} /> : undefined}
          onPress={canReceive ? () => router.push({ pathname: '/maal/receive', params: { kind: 'dispatch', id: d.id } }) : undefined}
        />
      ))}
      {data.purchases.map((p) => (
        <ListItem
          key={p.id}
          icon="🛒"
          iconTone="accent"
          title={`${p.challanNo} · ${p.supplier.name}`}
          subtitle={[p.vehicleNo, f.shortDate(p.purchaseDate)].filter(Boolean).join(' · ')}
          right={canReceive ? <StatusChip tone="primary" label={t('maal.receive')} /> : undefined}
          onPress={canReceive ? () => router.push({ pathname: '/maal/receive', params: { kind: 'purchase', id: p.id } }) : undefined}
        />
      ))}
      {data.equipment.map((tr) => (
        <ListItem
          key={tr.id}
          testID={`incoming-${tr.number}`}
          icon="crane"
          iconTone="violet"
          title={`${tr.number} · ${t('eq.from', { from: tr.from })}`}
          subtitle={[tr.items.map((i) => data.eq.get(i.equipmentId)?.name).filter(Boolean).join(', '), f.dateTime(tr.sentAt)].filter(Boolean).join(' · ')}
          right={canReceiveEq ? <StatusChip tone="primary" label={t('eq.receive')} /> : undefined}
          onPress={canReceiveEq ? () => router.push({ pathname: '/maal/equipment-receive', params: { id: tr.id } }) : undefined}
        />
      ))}
      <View className="mt-3 flex-row items-center gap-2">
        <Icon name="chart-box-outline" size={20} color={COLORS.primary} />
        <Text className="font-bold text-lg text-ink">{t('maal.stock')}</Text>
      </View>
    </View>
  );

  return (
    <Screen header={header} scroll={false}>
      <FlashList
        data={data.stock}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={top}
        ListEmptyComponent={
          <View className="px-4">
            <EmptyState icon="📦" title={t('common.empty')} />
          </View>
        }
        renderItem={({ item }) => <StockItem item={item} />}
      />
    </Screen>
  );
}
