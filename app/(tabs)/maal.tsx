import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { incomingDispatches, incomingPurchases, siteStock } from '@/features/queries';
import { useT } from '@/i18n';
import { dateTime, shortDate } from '@/lib/dates';

import { qty } from '@/lib/qty';

/** Material: deliveries on the way, quick entries, site stock. */
export default function MaalScreen() {
  const t = useT();
  const { projectId } = useProject();
  const data = useQuery((db) => (projectId ? { dispatches: incomingDispatches(db, projectId), purchases: incomingPurchases(db, projectId), stock: siteStock(db, projectId) } : null), [projectId]);
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
        <BigButton small variant="secondary" icon="🧱" label={t('maal.usage')} onPress={() => router.push('/maal/usage')} />
        <BigButton small variant="secondary" icon="📦" label={t('maal.ownerDelivery')} onPress={() => router.push('/maal/owner-delivery')} />
        <BigButton small variant="secondary" icon="🛒" label={t('maal.purchase')} onPress={() => router.push('/maal/purchase')} />
        <BigButton small variant="secondary" icon="🔢" label={t('maal.count')} onPress={() => router.push('/maal/count')} />
      </ScrollView>
      <Text className="font-semibold text-base text-ink">🚚 {t('maal.incoming')}</Text>
      {!data.dispatches.length && !data.purchases.length ? <Text className="text-sm text-muted">{t('maal.noIncoming')}</Text> : null}
      {data.dispatches.map((d) => (
        <ListItem
          key={d.id}
          testID={`incoming-${d.number}`}
          title={`${d.number} · ${d.from}`}
          subtitle={[d.vehicleNo, d.driverName, dateTime(d.dispatchedAt)].filter(Boolean).join(' · ')}
          right={<StatusChip tone="primary" label={t('maal.receive')} />}
          onPress={() => router.push({ pathname: '/maal/receive', params: { kind: 'dispatch', id: d.id } })}
        />
      ))}
      {data.purchases.map((p) => (
        <ListItem
          key={p.id}
          title={`${p.challanNo} · ${p.supplier.name}`}
          subtitle={[p.vehicleNo, shortDate(p.purchaseDate)].filter(Boolean).join(' · ')}
          right={<StatusChip tone="primary" label={t('maal.receive')} />}
          onPress={() => router.push({ pathname: '/maal/receive', params: { kind: 'purchase', id: p.id } })}
        />
      ))}
      <Text className="mt-2 font-semibold text-base text-ink">📊 {t('maal.stock')}</Text>
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
        renderItem={({ item }) => (
          <View className="mx-4 mb-2 min-h-14 flex-row items-center justify-between rounded-card border border-border bg-card px-4">
            <View className="flex-1">
              <Text className="font-medium text-ink">{item.material?.name ?? '—'}</Text>
              {item.ownerQuantity ? <Text className="text-xs text-muted">{t('maal.ownerQty', { qty: qty(item.ownerQuantity) })}</Text> : null}
            </View>
            <Text className="font-semibold text-lg text-ink">
              {qty(item.quantity)} <Text className="text-sm text-muted">{item.material?.unit}</Text>
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}
