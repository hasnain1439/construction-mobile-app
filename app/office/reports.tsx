import { router } from 'expo-router';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { Screen } from '@components/Screen';
import { usePermissions } from '@/features/access';
import { reportsFor } from '@/features/office';
import { useI18n } from '@/i18n';

/** Office → Reports: the reports this role may open on the web, the same rules. */
export default function OfficeReports() {
  const { t } = useI18n();
  const p = usePermissions();
  const reports = reportsFor(p.access, p.role);
  return (
    <Screen refresh={false} header={<Header back title={t('office.reports')} subtitle={t('office.reportsHint')} />}>
      {reports.map((r) => (
        <ListItem key={r.name} testID={`report-${r.name}`} icon="file-chart-outline" iconTone="violet" title={t(r.title)} onPress={() => router.push({ pathname: '/office/report', params: { name: r.name } } as never)} />
      ))}
    </Screen>
  );
}
