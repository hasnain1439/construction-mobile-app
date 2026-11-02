/**
 * Office — the phone's mini dashboard per role: which sections and reports each role gets (the web's
 * keys), and the Office tab rendered for an owner (money shown) and a PM without financials (no money).
 */
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OfficeScreen from '../app/(tabs)/office';
import { I18nProvider } from '../src/i18n';
import { officeSections, OFFICE_TAB_KEYS, reportsFor } from '../src/features/office';
import { canAny, type Access, type Role } from '../src/lib/permissions';

jest.setTimeout(30000);

let mockRole: Role = 'THEKEDAR';
let mockAccess: Access | null = null;
const mockRequest = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/features/session', () => ({ useUser: () => ({ id: 'u1', name: 'Khalid Malik', role: mockRole }) }));
jest.mock('../src/features/access', () => {
  const perms = jest.requireActual('../src/lib/permissions');
  return {
    usePermissions: () => ({
      access: mockAccess,
      role: mockRole,
      can: (k: string) => perms.can(mockAccess, mockRole, k),
      canAny: (...k: string[]) => perms.canAny(mockAccess, mockRole, k),
      sees: (f: string) => perms.seesField(mockAccess, mockRole, f),
    }),
  };
});
jest.mock('../src/api/client', () => {
  const actual = jest.requireActual('../src/api/client');
  return { ...actual, request: (...args: unknown[]) => mockRequest(...args) };
});
jest.mock('../components/SyncBanner', () => ({ SyncBanner: () => null }));

const fields = (over: Partial<Access['fieldAccess']> = {}): Access['fieldAccess'] => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
const block = (permissions: string[], fieldAccess = fields()): Access => ({ permissions, fieldAccess, scopes: {}, approvalLimits: {}, permissionRole: null });

const MUNSHI = block(['labor.attendance.create', 'inventory.usage.create', 'masterdata.material.view', 'projects.project.view', 'dashboard.site.view']);
const PM = block(['dashboard.overview.view', 'masterdata.supplier.view', 'masterdata.material.view', 'clients.client.view', 'projects.project.view']);
const ACCOUNTANT = block(['finance.reports.view', 'masterdata.supplier.view', 'clients.client.view'], fields({ amounts: true, rates: true }));

describe('office sections per role', () => {
  it('owner: everything; munshi: nothing (no tab); PM and accountant: what their keys allow', () => {
    expect(officeSections(null, 'THEKEDAR')).toEqual(['overview', 'projects', 'reports', 'team', 'suppliers', 'customers', 'products']);
    expect(officeSections(MUNSHI, 'MUNSHI')).toEqual([]);
    expect(canAny(MUNSHI, 'MUNSHI', OFFICE_TAB_KEYS)).toBe(false);
    expect(officeSections(PM, 'PM')).toEqual(['overview', 'projects', 'suppliers', 'customers', 'products']);
    expect(officeSections(ACCOUNTANT, 'PM')).toEqual(['reports', 'suppliers', 'customers']);
    expect(canAny(ACCOUNTANT, 'PM', OFFICE_TAB_KEYS)).toBe(true);
  });

  it('reports follow the web rules: company-wide ones need finance.companyreports.view, project summary needs amounts', () => {
    expect(reportsFor(null, 'THEKEDAR').map((r) => r.name)).toContain('receivables-ageing');
    const names = reportsFor(ACCOUNTANT, 'PM').map((r) => r.name);
    expect(names).toEqual(['project-summary', 'cash-book', 'labor-peshgi', 'material-audit']);
    const noAmounts = reportsFor(block(['finance.reports.view']), 'PM').map((r) => r.name);
    expect(noAmounts).not.toContain('project-summary');
    expect(reportsFor(PM, 'PM')).toEqual([]);
  });
});

const OVERVIEW = {
  seesFinancials: true,
  kpis: {
    activeProjects: { count: 4, atRisk: 1, delayed: 2 },
    pendingApprovals: 3,
    openShortages: 0,
    dispatchesOnTheWay: 1,
    receivablesOutstandingPaisa: '286500000',
    overduePaisa: '93000000',
    supplierUdhaarPaisa: '145500000',
    storeStockValuePaisa: '39266600',
    cashWithSiteStaffPaisa: '930000',
  },
  projects: [],
};

const renderOffice = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initial="en">
        <OfficeScreen />
      </I18nProvider>
    </SafeAreaProvider>,
  );

describe('Office tab', () => {
  beforeEach(() => mockRequest.mockReset());

  it('owner: overview with money and every section', async () => {
    mockRole = 'THEKEDAR';
    mockAccess = null;
    mockRequest.mockResolvedValue(OVERVIEW);
    await renderOffice();
    expect(await screen.findByTestId('office-overview')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/dashboard/overview', expect.anything());
    for (const s of ['projects', 'reports', 'team', 'suppliers', 'customers', 'products']) expect(screen.getByTestId(`office-${s}`)).toBeTruthy();
    expect(screen.getAllByText(/28,65,000/).length).toBeGreaterThan(0);
  });

  it('PM without financials: counts only, no money; no reports or team', async () => {
    mockRole = 'PM';
    mockAccess = PM;
    const { receivablesOutstandingPaisa: _r, overduePaisa: _o, supplierUdhaarPaisa: _s, storeStockValuePaisa: _v, cashWithSiteStaffPaisa: _c, ...counts } = OVERVIEW.kpis;
    mockRequest.mockResolvedValue({ ...OVERVIEW, seesFinancials: false, kpis: counts });
    await renderOffice();
    expect(await screen.findByTestId('office-overview')).toBeTruthy();
    expect(screen.queryByText(/28,65,000/)).toBeNull();
    expect(screen.queryByTestId('office-reports')).toBeNull();
    expect(screen.queryByTestId('office-team')).toBeNull();
    expect(screen.getByTestId('office-suppliers')).toBeTruthy();
  });

  it('accountant without the overview: no request, just the sections', async () => {
    mockRole = 'PM';
    mockAccess = ACCOUNTANT;
    await renderOffice();
    expect(await screen.findByTestId('office-reports')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('office-overview')).toBeNull();
  });
});
