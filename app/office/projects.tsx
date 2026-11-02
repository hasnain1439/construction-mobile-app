import { useState } from 'react';
import { Header } from '@components/Header';
import { MoneyText } from '@components/MoneyText';
import { OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { ENDPOINTS } from '@/api/endpoints';
import { useOnline, type Overview } from '@/features/office';
import { useI18n, type TKey } from '@/i18n';

/** Office → Projects: every project of the role's scope with its money and progress (view only). */
export default function OfficeProjects() {
  const { t } = useI18n();
  const { state, data, reload } = useOnline<Overview>(ENDPOINTS.dashboardOverview);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (data?.projects ?? []).filter((r) => !needle || `${r.project.code} ${r.project.name} ${r.client?.name ?? ''}`.toLowerCase().includes(needle));
  return (
    <Screen refresh={false} header={<Header back title={t('office.projects')} subtitle={t('office.viewOnly')} />}>
      <OfficeSearch testID="projects-search" value={q} onChange={setQ} placeholder={t('office.searchProjects')} />
      <OfficeState state={state} onRetry={() => void reload()} empty={state === 'ready' && !rows.length}>
        {rows.map((r) => {
          const lines: [string, React.ReactNode][] = [];
          if (r.contractPaisa !== undefined) lines.push([t('office.contract'), <MoneyText key="c" paisa={r.contractPaisa} className="text-sm" />]);
          if (r.invoicedPaisa !== undefined) lines.push([t('office.billed'), <MoneyText key="b" paisa={r.invoicedPaisa} className="text-sm" />]);
          if (r.receivedPaisa !== undefined) lines.push([t('office.received'), <MoneyText key="r" paisa={r.receivedPaisa} className="text-sm" />]);
          if (r.outstandingPaisa !== undefined) lines.push([t('office.outstanding'), <MoneyText key="o" paisa={r.outstandingPaisa} className="text-sm" />]);
          if (r.overduePaisa && r.overduePaisa !== '0') lines.push([t('office.overdue'), <MoneyText key="d" paisa={r.overduePaisa} className="text-sm text-danger" />]);
          if (r.progressPercent !== undefined) lines.push([t('office.progress'), `${r.progressPercent}%`]);
          return (
            <OfficeCard
              key={r.project.id}
              testID={`project-${r.project.code}`}
              title={`${r.project.code} · ${r.project.name}`}
              subtitle={r.client?.name}
              right={<StatusChip tone={r.atRisk ? 'danger' : r.project.status === 'ACTIVE' ? 'success' : 'neutral'} label={r.atRisk ? t('office.atRisk') : t(`office.status.${r.project.status}` as TKey)} />}
              lines={lines}
            />
          );
        })}
      </OfficeState>
    </Screen>
  );
}
