import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
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
import { useProject } from '@/features/project';
import { incomingDispatches, incomingPurchases, siteStock } from '@/features/queries';
import { useT } from '@/i18n';
import { dateTime, shortDate } from '@/lib/dates';

import { qty } from '@/lib/qty';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

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
      <View className="mt-1 flex-row items-center gap-2">
        <Icon name="truck-delivery-outline" size={20} color={COLORS.info} />
        <Text className="font-bold text-lg text-ink">{t('maal.incoming')}</Text>
      </View>
      {!data.dispatches.length && !data.purchases.length ? (
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
          subtitle={[d.vehicleNo, d.driverName, dateTime(d.dispatchedAt)].filter(Boolean).join(' · ')}
          right={<StatusChip tone="primary" label={t('maal.receive')} />}
          onPress={() => router.push({ pathname: '/maal/receive', params: { kind: 'dispatch', id: d.id } })}
        />
      ))}
      {data.purchases.map((p) => (
        <ListItem
          key={p.id}
          icon="🛒"
          iconTone="accent"
          title={`${p.challanNo} · ${p.supplier.name}`}
          subtitle={[p.vehicleNo, shortDate(p.purchaseDate)].filter(Boolean).join(' · ')}
          right={<StatusChip tone="primary" label={t('maal.receive')} />}
          onPress={() => router.push({ pathname: '/maal/receive', params: { kind: 'purchase', id: p.id } })}
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
        renderItem={({ item }) => (
          <View className="mx-4 mb-2 min-h-16 flex-row items-center gap-3 rounded-card bg-card px-4 py-3" style={CARD_SHADOW}>
            <IconBadge name="🧱" tone="accent" size={40} />
            <View className="flex-1">
              <Text className="font-semibold text-ink">{item.material?.name ?? '—'}</Text>
              {item.ownerQuantity ? <Text className="text-xs text-muted">{t('maal.ownerQty', { qty: qty(item.ownerQuantity) })}</Text> : null}
            </View>
            <Text className="font-bold text-lg text-ink">
              {qty(item.quantity)} <Text className="text-sm text-muted">{item.material?.unit}</Text>
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}
