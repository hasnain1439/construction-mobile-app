import { useState } from 'react';
import { Header } from '@components/Header';
import { OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { ENDPOINTS } from '@/api/endpoints';
import { useOnline, type Product } from '@/features/office';
import { useI18n } from '@/i18n';

/** Office → Products: every material with its group, brand, quality and unit (no rates here). */
export default function OfficeProducts() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const { state, data, reload } = useOnline<Product[]>(ENDPOINTS.materials, { search: q.trim() || undefined });
  const rows = data ?? [];
  return (
    <Screen refresh={false} header={<Header back title={t('office.products')} subtitle={t('office.viewOnly')} />}>
      <OfficeSearch testID="products-search" value={q} onChange={setQ} placeholder={t('office.searchProducts')} />
      <OfficeState state={state} onRetry={() => void reload()} empty={state === 'ready' && !rows.length}>
        {rows.map((m) => (
          <OfficeCard
            key={m.id}
            testID={`product-${m.id}`}
            title={m.name}
            subtitle={[m.group.name, m.brand?.name, m.quality?.name].filter(Boolean).join(' · ')}
            lines={[[t('office.unit'), m.unit]]}
          />
        ))}
      </OfficeState>
    </Screen>
  );
}
