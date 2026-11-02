import { useState } from 'react';
import { Header } from '@components/Header';
import { CallButton, OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { ENDPOINTS } from '@/api/endpoints';
import { useOnline, type TeamMember } from '@/features/office';
import { roleLabel, useI18n } from '@/i18n';
import { displayPhone } from '@/lib/phone';

/** Office → Team: the company's users with their role, phone and status (changes stay on the web). */
export default function OfficeTeam() {
  const { t, f, language } = useI18n();
  const { state, data, reload } = useOnline<TeamMember[]>(ENDPOINTS.users, { limit: 100 });
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (data ?? []).filter((u) => !needle || `${u.name} ${u.phone} ${u.email ?? ''}`.toLowerCase().includes(needle));
  return (
    <Screen refresh={false} header={<Header back title={t('office.team')} subtitle={t('office.viewOnly')} />}>
      <OfficeSearch testID="team-search" value={q} onChange={setQ} placeholder={t('office.searchPeople')} />
      <OfficeState state={state} onRetry={() => void reload()} empty={state === 'ready' && !rows.length}>
        {rows.map((u) => (
          <OfficeCard
            key={u.id}
            testID={`member-${u.id}`}
            title={u.name}
            subtitle={`${roleLabel(language, u.role, u.permissionRole)} · ${displayPhone(u.phone)}`}
            right={<CallButton phone={u.phone} />}
            lines={[
              [t('office.status'), <StatusChip key="s" tone={u.status === 'ACTIVE' ? 'success' : 'neutral'} label={u.status === 'ACTIVE' ? t('office.active') : t('office.inactive')} />],
              ...(u.lastActiveAt ? ([[t('office.lastActive'), f.shortDate(u.lastActiveAt.slice(0, 10))]] as [string, string][]) : []),
            ]}
          />
        ))}
      </OfficeState>
    </Screen>
  );
}
