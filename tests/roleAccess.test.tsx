/**
 * Role-wise access on the phone = the web's permission system (PERMISSIONS_API.md §6), with one
 * deliberate difference: projects are never created from the phone, whatever the role.
 * Covers the helpers for each template (owner, administrator, PM, PM + financials, munshi, a custom
 * role) and a few screens rendered with those permissions.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AajScreen from '../app/(tabs)/aaj';
import HazriScreen from '../app/(tabs)/hazri';
import MaalScreen from '../app/(tabs)/maal';
import { saveAccess } from '../src/db/access';
import { putRow } from '../src/db/store';
import type { Db } from '../src/db/types';
import type { Ctx } from '../src/features/actions';
import { I18nProvider } from '../src/i18n';
import { can, canAny, PERM, routeAllowed, rules, seesField, TAB_PERMS, WEB_ONLY_KEYS, type Access, type Role } from '../src/lib/permissions';
import { testDb } from './helpers/db';

jest.setTimeout(30000);

const P = 'p1';
let mockDb: Db;
let mockRole: Role = 'MUNSHI';
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('../src/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/features/session', () => ({ useUser: () => ({ id: 'u1', name: 'Rafaqat Ali', role: mockRole }) }));
jest.mock('../src/features/project', () => {
  const project = { id: 'p1', name: 'DHA House', code: 'P-1', status: 'ACTIVE', siteAddress: null, city: null };
  return { useProject: () => ({ projectId: 'p1', project, projects: [project], setProjectId: jest.fn() }) };
});
jest.mock('../src/features/useSave', () => ({ useSave: () => (action: (db: Db, c: Ctx) => unknown) => action(mockDb, { userId: 'u1', userName: 'Rafaqat Ali' }) }));

const fields = (over: Partial<Access['fieldAccess']> = {}): Access['fieldAccess'] => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
const block = (permissions: string[], fieldAccess: Access['fieldAccess'], key: string | null): Access => ({
  permissions,
  fieldAccess,
  scopes: {},
  approvalLimits: {},
  permissionRole: key ? { id: key, key, name: key } : null,
});

/** The MUNSHI template (site keys only — what the phone uses). */
const MUNSHI_KEYS = [
  'cashbook.account.view', 'cashbook.count.create', 'cashbook.expense.create', 'cashbook.expense.view', 'cashbook.handover.create', 'cashbook.topup.create', 'cashbook.topup.view',
  'dailylog.log.create', 'dailylog.log.view', 'inventory.count.create', 'inventory.count.view', 'inventory.ownerdelivery.create', 'inventory.ownerdelivery.view', 'inventory.stock.view', 'inventory.usage.create',
  'labor.advance.create', 'labor.advance.view', 'labor.attendance.create', 'labor.attendance.view', 'labor.measurement.create', 'labor.measurement.view', 'labor.settlement.create', 'labor.settlement.view',
  'labor.team.create', 'labor.team.view', 'labor.wagepayment.create', 'masterdata.worker.create', 'masterdata.worker.view', 'procurement.dispatch.view', 'procurement.purchase.create',
  'procurement.purchase.view', 'procurement.receiving.create', 'projects.project.view', 'schedule.plan.view', 'schedule.progress.edit', 'schedule.stoppage.create', 'changeorder.instruction.create',
  'equipment.view', 'equipment.receiving.create', 'equipment.loss.create', 'closeout.drawing.view', 'closeout.snag.view', 'closeout.snag.create', 'fields.wages',
];
/** PROJECT_MANAGER template: the munshi's site keys + office keys (incl. project create on the web) + rates. */
const PM_KEYS = [
  ...MUNSHI_KEYS,
  'projects.project.create', 'projects.project.edit', 'projects.project.approve', 'labor.settlement.approve', 'labor.measurement.approve', 'cashbook.expense.approve',
  'changeorder.instruction.view', 'closeout.snag.manage', 'closeout.drawing.manage', 'schedule.stoppage.approve', 'approvals.inbox.view', 'fields.rates',
];
const FIN_BUNDLE = ['billing.invoice.view', 'billing.invoice.create', 'billing.payment.view', 'billing.payment.create', 'finance.pnl.view', 'fields.amounts', 'fields.profit', 'fields.contract'];

const ROLES: Record<string, { role: Role; access: Access | null }> = {
  owner: { role: 'THEKEDAR', access: block([], fields({ rates: true, amounts: true, profit: true, contract: true }), null) },
  admin: { role: 'PM', access: block([...PM_KEYS, ...FIN_BUNDLE, 'projects.project.manage', 'team.member.manage'], fields({ rates: true, amounts: true, profit: true, contract: true }), 'ADMINISTRATOR') },
  pm: { role: 'PM', access: block(PM_KEYS, fields({ rates: true }), 'PROJECT_MANAGER') },
  pmFin: { role: 'PM', access: block([...PM_KEYS, ...FIN_BUNDLE], fields({ rates: true, amounts: true, profit: true, contract: true }), 'PROJECT_MANAGER') },
  munshi: { role: 'MUNSHI', access: block(MUNSHI_KEYS, fields(), 'MUNSHI') },
  /** A custom role (baseRole OTHER) on a site account: records usage and the daily log, nothing else. */
  custom: { role: 'MUNSHI', access: block(['inventory.usage.create', 'dailylog.log.create', 'projects.project.view'], fields({ wages: false }), 'CUSTOM') },
  /** ACCOUNTANT template on an office account: views wages / cash, marks nothing. */
  accountant: {
    role: 'PM',
    access: block(
      ['labor.advance.view', 'labor.settlement.view', 'cashbook.account.view', 'cashbook.expense.view', 'cashbook.topup.view', 'procurement.purchase.view', 'schedule.plan.view', 'closeout.snag.view', 'fields.rates', 'fields.amounts', 'fields.contract', 'fields.wages'],
      fields({ rates: true, amounts: true, contract: true }),
      'ACCOUNTANT',
    ),
  },
};

describe('role matrix (helpers)', () => {
  const each = Object.entries(ROLES);

  it('no role — not even the owner or an administrator — may create a project on the phone', () => {
    expect(WEB_ONLY_KEYS).toContain('projects.project.create');
    for (const [, r] of each) expect(can(r.access, r.role, 'projects.project.create')).toBe(false);
    // Without a stored block (older build) too.
    expect(can(null, 'THEKEDAR', 'projects.project.create')).toBe(false);
    expect(can(null, 'PM', 'projects.project.create')).toBe(false);
    // Viewing / editing still follow the keys.
    expect(can(ROLES.pm!.access, 'PM', 'projects.project.edit')).toBe(true);
    expect(can(ROLES.munshi!.access, 'MUNSHI', 'projects.project.edit')).toBe(false);
    expect(can(ROLES.owner!.access, 'THEKEDAR', 'projects.project.edit')).toBe(true);
  });

  it('money fields follow fieldAccess: PM sees rates only, PM + financials and admin see amounts / profit / contract, munshi none', () => {
    const sees = (k: string) => (['rates', 'amounts', 'profit', 'contract', 'wages'] as const).filter((f) => seesField(ROLES[k]!.access, ROLES[k]!.role, f));
    expect(sees('owner')).toEqual(['rates', 'amounts', 'profit', 'contract', 'wages']);
    expect(sees('admin')).toEqual(['rates', 'amounts', 'profit', 'contract', 'wages']);
    expect(sees('pmFin')).toEqual(['rates', 'amounts', 'profit', 'contract', 'wages']);
    expect(sees('pm')).toEqual(['rates', 'wages']);
    expect(sees('munshi')).toEqual(['wages']);
    expect(sees('accountant')).toEqual(['rates', 'amounts', 'contract', 'wages']);
    expect(sees('custom')).toEqual([]);
  });

  it('tabs per role', () => {
    const tabs = (k: string) => (['hazri', 'maal', 'kharcha'] as const).filter((tab) => canAny(ROLES[k]!.access, ROLES[k]!.role, TAB_PERMS[tab]));
    expect(tabs('owner')).toEqual(['hazri', 'maal', 'kharcha']);
    expect(tabs('pm')).toEqual(['hazri', 'maal', 'kharcha']);
    expect(tabs('munshi')).toEqual(['hazri', 'maal', 'kharcha']);
    expect(tabs('custom')).toEqual(['maal']);
    expect(tabs('accountant')).toEqual(['hazri', 'kharcha']);
  });

  it('actions and screens per role use the keys, not the role name', () => {
    const r = (k: string) => ROLES[k]!;
    // Munshi: marks hazri, pays wages, asks for top-ups; no wage rate on a new worker.
    expect(can(r('munshi').access, 'MUNSHI', PERM.hazriMark)).toBe(true);
    expect(rules.payWages(r('munshi').access, 'MUNSHI')).toBe(true);
    expect(rules.requestTopup(r('munshi').access, 'MUNSHI')).toBe(true);
    expect(rules.setWorkerRate(r('munshi').access, 'MUNSHI')).toBe(false);
    // PM without financials: sets a worker's rate, sees all instructions, manages snags.
    expect(rules.setWorkerRate(r('pm').access, 'PM')).toBe(true);
    expect(can(r('pm').access, 'PM', PERM.instructionView)).toBe(true);
    expect(can(r('pm').access, 'PM', PERM.snagManage)).toBe(true);
    expect(can(r('munshi').access, 'MUNSHI', PERM.snagManage)).toBe(false);
    // Owner: everything, but sends cash rather than asking for it.
    expect(rules.requestTopup(r('owner').access, 'THEKEDAR')).toBe(false);
    expect(can(r('owner').access, 'THEKEDAR', PERM.equipmentLoss)).toBe(true);
    // Accountant (an office account) can't mark hazri or pay wages — the PM account type alone gives nothing.
    expect(can(r('accountant').access, 'PM', PERM.hazriMark)).toBe(false);
    expect(rules.payWages(r('accountant').access, 'PM')).toBe(false);
    expect(routeAllowed(r('accountant').access, 'PM', '/hazri/settlement')).toBe(true);
    expect(routeAllowed(r('accountant').access, 'PM', '/hazri/peshgi')).toBe(false);
    // Custom role: only usage and the daily log.
    expect(routeAllowed(r('custom').access, 'MUNSHI', '/maal/usage')).toBe(true);
    expect(routeAllowed(r('custom').access, 'MUNSHI', '/maal/receive')).toBe(false);
    expect(routeAllowed(r('custom').access, 'MUNSHI', '/kharcha/new')).toBe(false);
  });
});

describe('no project-create entry point in the app', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  const root = join(__dirname, '..');

  it('has no project route and no screen asks for projects.project.create', () => {
    const screens = [...files(join(root, 'app')), ...files(join(root, 'components'))];
    expect(screens.filter((f) => /project/i.test(f.slice(root.length)) && !/ProjectSwitcher/.test(f))).toEqual([]);
    for (const f of screens) expect(readFileSync(f, 'utf8')).not.toMatch(/projects\.project\.create|PROJECT_CREATE|\/projects?\/new/);
  });
});

// ---------- screens ----------

const wrap = (el: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initial="roman">{el}</I18nProvider>
    </SafeAreaProvider>,
  );
type Node = { children?: (Node | string)[] | null } | string | null;
const textOf = (n: Node | Node[]): string => (n === null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join(' ') : (n.children ?? []).map(textOf).join(' '));
const allText = () => textOf(screen.toJSON() as Node | Node[]);

function as(key: keyof typeof ROLES) {
  const r = ROLES[key]!;
  mockRole = r.role;
  mockDb = testDb();
  putRow(mockDb, 'projects', { id: P, name: 'DHA House', code: 'P-1', status: 'ACTIVE' });
  putRow(mockDb, 'workers', { id: 'w1', name: 'Bashir Ahmed', type: 'MAZDOOR', phone: null, isActive: true });
  putRow(mockDb, 'project_workers', { id: 'pw1', projectId: P, workerId: 'w1', startDate: '2026-10-01', endDate: null, isActive: true });
  if (r.access) saveAccess(mockDb, r.access);
}

describe('Hazri tab', () => {
  it('munshi: the attendance list with Full / Half / Absent and every labour button', async () => {
    as('munshi');
    await wrap(<HazriScreen />);
    expect(screen.getByTestId('mark-Bashir Ahmed-FULL')).toBeTruthy();
    for (const label of ['Naya mazdoor', 'Peshgi', 'Kaam ki paimaish', 'Hafta war hisaab']) expect(allText()).toContain(label);
  });

  it('accountant: no attendance list or marking — only weekly wages (view)', async () => {
    as('accountant');
    await wrap(<HazriScreen />);
    const text = allText();
    expect(screen.queryByTestId('mark-Bashir Ahmed-FULL')).toBeNull();
    expect(screen.queryByTestId('save-hazri')).toBeNull();
    expect(text).not.toContain('Bashir Ahmed');
    expect(text).not.toMatch(/Naya mazdoor|Peshgi|paimaish/);
    expect(text).toContain('Hafta war hisaab');
  });
});

describe('Maal tab', () => {
  it('munshi: incoming and stock sections plus his buttons', async () => {
    as('munshi');
    await wrap(<MaalScreen />);
    const text = allText();
    for (const label of ['Raaste mein', 'Site ka stock', 'Maal lag gaya', 'Maalik ka maal', 'Site par khareedari', 'Stock ginti']) expect(text).toContain(label);
  });

  it('custom usage-only role: just the usage button, no empty incoming / stock sections', async () => {
    as('custom');
    await wrap(<MaalScreen />);
    const text = allText();
    expect(text).toContain('Maal lag gaya');
    expect(text).not.toMatch(/Raaste mein|Site ka stock|Maalik ka maal|khareedari|Stock ginti/);
  });
});

describe('Aaj quick actions', () => {
  const QUICK = ['Hazri', 'Maal lag gaya', 'Kharcha likhein', 'Roz ka log', 'Peshgi', 'Maalik ka maal'];
  it.each(['owner', 'pm'] as const)('%s gets every site action; nothing offers a new project', async (who) => {
    as(who);
    await wrap(<AajScreen />);
    for (const q of QUICK) expect(screen.getByLabelText(q)).toBeTruthy();
    expect(allText()).not.toMatch(/naya project|new project/i);
  });

  it('custom role: only its own actions', async () => {
    as('custom');
    await wrap(<AajScreen />);
    expect(screen.getByLabelText('Maal lag gaya')).toBeTruthy();
    expect(screen.getByLabelText('Roz ka log')).toBeTruthy();
    for (const q of ['Hazri', 'Kharcha likhein', 'Peshgi', 'Maalik ka maal']) expect(screen.queryByLabelText(q)).toBeNull();
  });
});
