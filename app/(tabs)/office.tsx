import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { MoneyText } from '@components/MoneyText';
import { OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { usePermissions } from '@/features/access';
import { approvalsCount, OFFICE_PERM, officeSections, useOnline, type OfficeSection, type Overview } from '@/features/office';
import { ENDPOINTS } from '@/api/endpoints';
import { roleLabel, useI18n, type TKey } from '@/i18n';
import { useUser } from '@/features/session';
import { StatTile } from '@components/StatTile';
import { CompanyCharts } from '@components/CompanyCharts';


const LINKS: Record<Exclude<OfficeSection, 'overview'>, { icon: string; tone: 'primary' | 'info' | 'accent' | 'violet' | 'success' | 'warning'; title: TKey; hint: TKey; href: string }> = {
  projects: { icon: 'office-building-outline', tone: 'primary', title: 'office.projects', hint: 'office.projectsHint', href: '/office/projects' },
  reports: { icon: 'file-chart-outline', tone: 'violet', title: 'office.reports', hint: 'office.reportsHint', href: '/office/reports' },
  expenses: { icon: 'receipt-text-outline', tone: 'warning', title: 'office.expenses', hint: 'office.expensesHint', href: '/office/expenses' },
  team: { icon: 'account-group-outline', tone: 'info', title: 'office.team', hint: 'office.teamHint', href: '/office/team' },
  suppliers: { icon: 'truck-outline', tone: 'accent', title: 'office.suppliers', hint: 'office.suppliersHint', href: '/office/suppliers' },
  customers: { icon: 'account-tie-outline', tone: 'success', title: 'office.customers', hint: 'office.customersHint', href: '/office/customers' },
  products: { icon: 'package-variant-closed', tone: 'warning', title: 'office.products', hint: 'office.productsHint', href: '/office/products' },
};

/**
 * Office — the phone's mini dashboard, per role: the overview (with money when the role sees it)
 * and the office pages the role may open. Projects are viewed here, never created.
 */
export default function OfficeScreen() {
  const { t, language } = useI18n();
  const p = usePermissions();
  const user = useUser();
  const sections = officeSections(p.access, p.role);
  const overview = useOnline<Overview>(sections.includes('overview') ? ENDPOINTS.dashboardOverview : null);
  const k = overview.data?.kpis;
  const money = Boolean(overview.data?.seesFinancials && k?.receivablesOutstandingPaisa !== undefined);

  return (
    <Screen header={<Header title={t('office.title')} subtitle={user ? `${user.name} · ${roleLabel(language, user.role, p.access?.permissionRole)}` : undefined} />}>
      {sections.includes('overview') ? (
        <OfficeState state={overview.state} onRetry={() => void overview.reload()}>
          {k ? (
            <View testID="office-overview" className="flex-row flex-wrap gap-3">
              <StatTile label={t('office.kpi.active')}>{k.activeProjects.count}</StatTile>
              <StatTile label={t('office.kpi.delayed')} tone={k.activeProjects.delayed ? 'warning' : undefined}>
                {k.activeProjects.delayed}
              </StatTile>
              <StatTile label={t('office.kpi.approvals')} tone={approvalsCount(k.pendingApprovals) ? 'warning' : undefined}>
                {approvalsCount(k.pendingApprovals)}
              </StatTile>
              <StatTile label={t('office.kpi.onTheWay')}>{k.dispatchesOnTheWay}</StatTile>
              {money ? (
                <>
                  <StatTile label={t('office.kpi.receivable')}>
                    <MoneyText paisa={k.receivablesOutstandingPaisa!} className="text-lg" />
                  </StatTile>
                  <StatTile label={t('office.kpi.overdue')}>
                    <MoneyText paisa={k.overduePaisa ?? '0'} className={`text-lg ${k.overduePaisa && k.overduePaisa !== '0' ? 'text-danger' : ''}`} />
                  </StatTile>
                  <StatTile label={t('office.kpi.supplierUdhaar')}>
                    <MoneyText paisa={k.supplierUdhaarPaisa ?? '0'} className="text-lg" />
                  </StatTile>
                  <StatTile label={t('office.kpi.cashWithStaff')}>
                    <MoneyText paisa={k.cashWithSiteStaffPaisa ?? '0'} className="text-lg" />
                  </StatTile>
                  <StatTile label={t('office.kpi.storeStock')}>
                    <MoneyText paisa={k.storeStockValuePaisa ?? '0'} className="text-lg" />
                  </StatTile>
                  <StatTile label={t('office.kpi.atRisk')} tone={k.activeProjects.atRisk ? 'danger' : undefined}>
                    {k.activeProjects.atRisk}
                  </StatTile>
                </>
              ) : null}
            </View>
          ) : null}
        </OfficeState>
      ) : null}
      {overview.data ? <CompanyCharts overview={overview.data} /> : null}
      {sections.length ? <Text className="mt-2 font-bold text-lg text-ink">{t('office.open')}</Text> : null}
      {sections
        .filter((s): s is Exclude<OfficeSection, 'overview'> => s !== 'overview')
        .map((s) => (
          <ListItem key={s} testID={`office-${s}`} icon={LINKS[s].icon} iconTone={LINKS[s].tone} title={t(LINKS[s].title)} subtitle={t(LINKS[s].hint)} onPress={() => router.push(LINKS[s].href as never)} />
        ))}
      {!sections.length ? <Text className="text-sm text-muted">{t('office.nothing')}</Text> : null}
      {p.can(OFFICE_PERM.overview) ? <Text className="text-xs text-muted">{t('office.webOnly')}</Text> : null}
    </Screen>
  );
}
