import { useState } from 'react';
import { Header } from '@components/Header';
import { CallButton, OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { ENDPOINTS } from '@/api/endpoints';
import { useOnline, type Customer } from '@/features/office';
import { useI18n } from '@/i18n';
import { displayPhone } from '@/lib/phone';

/** Office → Customers: the company's clients with phone and email. */
export default function OfficeCustomers() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const { state, data, reload } = useOnline<Customer[]>(ENDPOINTS.clients, { limit: 100, search: q.trim() || undefined });
  const rows = data ?? [];
  return (
    <Screen refresh={false} header={<Header back title={t('office.customers')} subtitle={t('office.viewOnly')} />}>
      <OfficeSearch testID="customers-search" value={q} onChange={setQ} placeholder={t('office.searchPeople')} />
      <OfficeState state={state} onRetry={() => void reload()} empty={state === 'ready' && !rows.length}>
        {rows.map((c) => (
          <OfficeCard key={c.id} testID={`customer-${c.id}`} title={c.name} subtitle={[displayPhone(c.phone), c.email].filter(Boolean).join(' · ')} right={<CallButton phone={c.phone} />} />
        ))}
      </OfficeState>
    </Screen>
  );
}
