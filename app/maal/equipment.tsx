import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Icon } from '@components/Icon';
import { IconBadge } from '@components/IconBadge';
import { ListItem } from '@components/ListItem';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import { EQUIPMENT_ICON, equipmentLosses, equipmentMap, incomingEquipment, siteEquipment, type SiteEquipment } from '@/features/equipment';
import { useProject } from '@/features/project';
import { useI18n, type TKey } from '@/i18n';
import { PERM } from '@/lib/permissions';
import { qty } from '@/lib/qty';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

/** One line on site: name, category, own / rented — counts only (no hire rates or values). */
const EquipmentItem = memo(function EquipmentItem({ item }: { item: SiteEquipment }) {
  const { t, f } = useI18n();
  const e = item.equipment;
  return (
    <View testID={`eq-${item.id}`} className="mx-4 mb-2 min-h-16 flex-row items-center gap-3 rounded-card bg-card px-4 py-3" style={CARD_SHADOW}>
      <IconBadge name={EQUIPMENT_ICON[e?.category ?? 'OTHER']} tone={item.rentalId ? 'violet' : 'accent'} size={40} />
      <View className="flex-1">
        <Text className="font-semibold text-ink">{e ? `${e.name} · ${e.code}` : '—'}</Text>
        <Text className="text-xs text-muted">
          {[e ? t(`eqcat.${e.category}` as TKey) : null, item.rentalId ? (item.rental ? t('eq.rented', { supplier: item.rental.supplierName }) : t('eq.rentedShort')) : t('eq.owned')].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text className="font-bold text-lg text-ink">
        {qty(item.quantity)} <Text className="text-sm text-muted">{f.unit(e?.unit)}</Text>
      </Text>
    </View>
  );
});

/** Machinery & shuttering: what is coming (receive with a count), what is on site, losses reported. */
export default function EquipmentScreen() {
  const { t, f } = useI18n();
  const p = usePermissions();
  const { projectId, project } = useProject();
  const data = useQuery((db) => (projectId ? { stock: siteEquipment(db, projectId), incoming: incomingEquipment(db, projectId), losses: equipmentLosses(db, projectId).slice(0, 20), eq: equipmentMap(db) } : null), [projectId]);
  const canReceive = p.can(PERM.equipmentReceive);
  const header = <Header back title={t('eq.title')} subtitle={project?.name} />;
  if (!data) {
    return (
      <Screen header={header}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const top = (
    <View className="gap-3 p-4">
      {p.can(PERM.equipmentLoss) ? <BigButton small variant="secondary" icon="alert-octagon-outline" label={t('eq.reportLoss')} onPress={() => router.push('/maal/equipment-loss')} /> : null}
      <View className="flex-row items-center gap-2">
        <Icon name="truck-delivery-outline" size={20} color={COLORS.info} />
        <Text className="font-bold text-lg text-ink">{t('eq.incoming')}</Text>
      </View>
      {!data.incoming.length ? (
        <View className="rounded-card border border-dashed border-border bg-card px-4 py-3">
          <Text className="text-sm text-muted">{t('maal.noIncoming')}</Text>
        </View>
      ) : null}
      {data.incoming.map((tr) => (
        <ListItem
          key={tr.id}
          testID={`eq-incoming-${tr.number}`}
          icon="🚚"
          iconTone="info"
          title={`${tr.number} · ${t('eq.from', { from: tr.from })}`}
          subtitle={[tr.items.map((i) => data.eq.get(i.equipmentId)?.name).filter(Boolean).join(', '), f.dateTime(tr.sentAt)].filter(Boolean).join(' · ')}
          right={canReceive ? <StatusChip tone="primary" label={t('maal.receive')} /> : undefined}
          onPress={canReceive ? () => router.push({ pathname: '/maal/equipment-receive', params: { id: tr.id } }) : undefined}
        />
      ))}
      {data.losses.length ? (
        <>
          <Text className="mt-2 font-bold text-lg text-ink">{t('eq.losses')}</Text>
          {data.losses.map((l) => (
            <ListItem
              key={l.id}
              icon={l.kind === 'MISSING' ? 'help-circle-outline' : 'hammer-wrench'}
              iconTone={l.kind === 'MISSING' ? 'danger' : 'warning'}
              title={`${data.eq.get(l.equipmentId)?.name ?? '—'} × ${qty(l.qty)}`}
              subtitle={[l.number !== '—' ? l.number : null, t(`losskind.${l.kind}` as TKey), f.dateTime(l.reportedAt), l.note].filter(Boolean).join(' · ')}
              right={<StatusChip tone={l.pendingSync ? 'accent' : l.status === 'CHARGED' ? 'success' : 'neutral'} label={l.pendingSync ? `⏳ ${t('kharcha.notSynced')}` : t(`lossstatus.${l.status}` as TKey)} />}
            />
          ))}
        </>
      ) : null}
      <View className="mt-2 flex-row items-center gap-2">
        <Icon name="crane" size={20} color={COLORS.primary} />
        <Text className="font-bold text-lg text-ink">{t('eq.onSite')}</Text>
      </View>
    </View>
  );

  return (
    <Screen header={header} scroll={false}>
      <FlashList
        data={data.stock}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={top}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View className="px-4">
            <EmptyState icon="crane" title={t('eq.empty')} />
          </View>
        }
        renderItem={({ item }) => <EquipmentItem item={item} />}
      />
    </Screen>
  );
}
