import { useState } from 'react';
import { Header } from '@components/Header';
import { MoneyText } from '@components/MoneyText';
import { CallButton, OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { ENDPOINTS } from '@/api/endpoints';
import { useOnline, type Supplier } from '@/features/office';
import { useI18n } from '@/i18n';
import { displayPhone } from '@/lib/phone';

/** Office → Suppliers: dealers with category, phone and (with rates) what is owed and how old. */
export default function OfficeSuppliers() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const { state, data, reload } = useOnline<Supplier[]>(ENDPOINTS.suppliers, { limit: 100, search: q.trim() || undefined });
  const rows = data ?? [];
  return (
    <Screen refresh={false} header={<Header back title={t('office.suppliers')} subtitle={t('office.viewOnly')} />}>
      <OfficeSearch testID="suppliers-search" value={q} onChange={setQ} placeholder={t('office.searchSuppliers')} />
      <OfficeState state={state} onRetry={() => void reload()} empty={state === 'ready' && !rows.length}>
        {rows.map((s) => {
          const lines: [string, React.ReactNode][] = [];
          if (s.udhaarBalancePaisa !== undefined) lines.push([t('office.owed'), <MoneyText key="o" paisa={s.udhaarBalancePaisa} className="text-sm" />]);
          if (s.oldestUnpaidDays) lines.push([t('office.oldestUnpaid'), t('office.days', { n: s.oldestUnpaidDays })]);
          if (!s.isActive) lines.push([t('office.status'), t('office.inactive')]);
          return (
            <OfficeCard
              key={s.id}
              testID={`supplier-${s.id}`}
              title={s.name}
              subtitle={[s.category, s.city, s.phone ? displayPhone(s.phone) : null].filter(Boolean).join(' · ')}
              right={<CallButton phone={s.phone} />}
              lines={lines}
            />
          );
        })}
      </OfficeState>
    </Screen>
  );
}
