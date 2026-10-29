/**
 * "Meri approvals" on the phone: who sees the entry point and the screen (owner, administrator,
 * PM, PM + financials yes; munshi and accountant no), approval limits (button disabled with the
 * reason, APPROVAL_LIMIT_EXCEEDED from the server), reject / return / reopen reasons, offline,
 * and the REST calls each kind makes.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ApprovalsScreen from '../app/approvals';
import AajScreen from '../app/(tabs)/aaj';
import MazeedScreen from '../app/(tabs)/mazeed';
import { ApiError, NetworkError } from '../src/api/client';
import { saveAccess } from '../src/db/access';
import { putRow } from '../src/db/store';
import type { Db } from '../src/db/types';
import {
  approvalLimitOf,
  canApproveAnything,
  canUseInbox,
  fromServer,
  localApprovals,
  runApproval,
  setServerApprovalsCount,
  withinLimit,
  type ApprovalsResponse,
  type ServerApprovalItem,
} from '../src/features/approvals';
import { I18nProvider, translate } from '../src/i18n';
import { routeAllowed, type Access, type Role } from '../src/lib/permissions';
import { syncFromApp } from '../src/sync/triggers';
import { testDb } from './helpers/db';

jest.setTimeout(30000);

let mockDb: Db;
let mockRole: Role = 'PM';
const mockRequest = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}), usePathname: () => '/approvals' }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('../src/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../src/api/client', () => ({ ...jest.requireActual('../src/api/client'), request: (...args: unknown[]) => mockRequest(...args) }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/sync/uploadPolicy', () => ({ useWifiOnly: () => [false, jest.fn()] }));
jest.mock('../src/features/session', () => ({
  useUser: () => ({ id: 'u1', name: 'Rafaqat Ali', role: mockRole, phone: '+923001234567', tenantName: 'Mughal Builders' }),
  useSession: () => ({ logout: jest.fn() }),
}));
jest.mock('../src/features/project', () => {
  const project = { id: 'p1', name: 'DHA House', code: 'P-1', status: 'ACTIVE', siteAddress: null, city: null };
  return { useProject: () => ({ projectId: 'p1', project, projects: [project], setProjectId: jest.fn() }) };
});

// ---------- roles (the server's templates, approve keys only where they matter) ----------

const fields = (over: Partial<Access['fieldAccess']> = {}): Access['fieldAccess'] => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
const block = (permissions: string[], fieldAccess: Access['fieldAccess'], key: string | null, approvalLimits: Record<string, string | null> = {}): Access => ({
  permissions,
  fieldAccess,
  scopes: {},
  approvalLimits,
  permissionRole: key ? { id: key, key, name: key } : null,
});
const SITE = ['projects.project.view', 'labor.attendance.view', 'cashbook.expense.view', 'schedule.plan.view', 'closeout.snag.view', 'labor.measurement.view'];
const PM_APPROVE = ['labor.settlement.approve', 'labor.measurement.approve', 'cashbook.expense.approve', 'schedule.stoppage.approve', 'closeout.snag.manage', 'approvals.inbox.view'];
const FIN = ['fields.amounts', 'fields.profit', 'fields.contract'];

const ROLES: Record<string, { role: Role; access: Access }> = {
  owner: { role: 'THEKEDAR', access: block([], fields({ rates: true, amounts: true, profit: true, contract: true }), null) },
  admin: { role: 'PM', access: block([...SITE, ...PM_APPROVE, 'cashbook.topup.approve', ...FIN, 'fields.rates'], fields({ rates: true, amounts: true, profit: true, contract: true }), 'ADMINISTRATOR') },
  pm: { role: 'PM', access: block([...SITE, ...PM_APPROVE, 'fields.rates'], fields({ rates: true }), 'PROJECT_MANAGER', { 'cashbook.expense.approve': '5000000', 'labor.settlement.approve': null, 'labor.measurement.approve': null }) },
  pmFin: { role: 'PM', access: block([...SITE, ...PM_APPROVE, ...FIN, 'fields.rates'], fields({ rates: true, amounts: true, profit: true, contract: true }), 'PROJECT_MANAGER') },
  munshi: { role: 'MUNSHI', access: block([...SITE, 'labor.attendance.create', 'cashbook.expense.create', 'schedule.stoppage.create', 'closeout.snag.create'], fields(), 'MUNSHI') },
  accountant: { role: 'PM', access: block(['labor.settlement.view', 'cashbook.account.view', 'cashbook.expense.view', 'cashbook.topup.view', 'schedule.plan.view', 'closeout.snag.view', 'fields.rates', 'fields.amounts'], fields({ rates: true, amounts: true }), 'ACCOUNTANT') },
  /** A custom office role: verifies measurements but sees no rates. */
  verifier: { role: 'PM', access: block(['labor.measurement.approve', 'approvals.inbox.view'], fields(), 'CUSTOM') },
};
const r = (k: keyof typeof ROLES) => ROLES[k]!;

const qa = (action: string, needsNote = false, needsMethod = false) => ({ action, label: action, needsNote, needsMethod }) as ServerApprovalItem['quickActions'][number];
const item = (over: Partial<ServerApprovalItem> & Pick<ServerApprovalItem, 'type' | 'id'>): ServerApprovalItem => ({
  title: 'x',
  subtitle: null,
  project: { id: 'p1', code: 'P-1', name: 'DHA House' },
  amountPaisa: null,
  createdAt: '2026-10-27T07:00:00.000Z',
  ageDays: 2,
  actionUrl: '/x',
  quickActions: [],
  ...over,
});
const INBOX: ApprovalsResponse = {
  total: 6,
  groups: [
    { type: 'SETTLEMENT_SUBMITTED', label: '', count: 1, totalPaisa: '2500000', items: [item({ type: 'SETTLEMENT_SUBMITTED', id: 'st1', title: 'Wages 18 Oct – 24 Oct', amountPaisa: '2500000', quickActions: [qa('approve'), qa('return', true)] })] },
    {
      type: 'EXPENSE_PENDING_APPROVAL',
      label: '',
      count: 2,
      totalPaisa: '9000000',
      items: [
        item({ type: 'EXPENSE_PENDING_APPROVAL', id: 'e-big', title: 'Bashir: Generator repair', amountPaisa: '6000000', quickActions: [qa('approve'), qa('reject', true)] }),
        item({ type: 'EXPENSE_PENDING_APPROVAL', id: 'e-own', title: 'Rafaqat Ali: Tea', amountPaisa: '3000000', quickActions: [] }),
      ],
    },
    { type: 'TOPUP_PENDING', label: '', count: 1, totalPaisa: '1000000', items: [item({ type: 'TOPUP_PENDING', id: 't1', project: null, amountPaisa: '1000000', quickActions: [qa('approve', false, true), qa('reject', true)] })] },
    { type: 'MEASUREMENT_TO_VERIFY', label: '', count: 1, totalPaisa: '6219000', items: [item({ type: 'MEASUREMENT_TO_VERIFY', id: 'm1', title: 'Ali Electric: 1382.5 sqft', amountPaisa: '6219000', quickActions: [qa('approve'), qa('reject', true)] })] },
    { type: 'INVOICE_DRAFT', label: '', count: 1, totalPaisa: '1', items: [item({ type: 'INVOICE_DRAFT', id: 'i1', amountPaisa: '1', quickActions: [qa('issue')] })] },
  ],
};

function seed(key: keyof typeof ROLES) {
  mockRole = r(key).role;
  mockDb = testDb();
  saveAccess(mockDb, r(key).access);
  putRow(mockDb, 'projects', { id: 'p1', name: 'DHA House', code: 'P-1', status: 'ACTIVE' });
  putRow(mockDb, 'stoppages', { id: 'sp1', projectId: 'p1', dates: ['2026-10-27', '2026-10-28'], reason: 'RAIN', category: 'EXCUSABLE', status: 'PENDING', note: null, photoAttachmentIds: [], clientId: null, reportedById: 'u9', reportedAt: '2026-10-27T05:00:00.000Z', decidedAt: null, decisionNote: null });
  putRow(mockDb, 'stoppages', { id: 'sp-local', projectId: 'p1', dates: ['2026-10-29'], reason: 'RAIN', category: 'EXCUSABLE', status: 'PENDING', note: null, photoAttachmentIds: [], clientId: 'c1', reportedById: 'u1', reportedAt: '2026-10-29T05:00:00.000Z', decidedAt: null, decisionNote: null, pendingSync: true });
  putRow(mockDb, 'snags', { id: 'sn1', projectId: 'p1', number: 3, code: 'SN-003', status: 'FIXED', description: 'Kitchen tile cracked', location: 'Kitchen', fixNote: 'Tile changed', fixedAt: '2026-10-28T09:00:00.000Z', updatedAt: '2026-10-28T09:00:00.000Z', beforePhotoIds: [], afterPhotoIds: [] });
  putRow(mockDb, 'snags', { id: 'sn2', projectId: 'p1', number: 4, code: 'SN-004', status: 'OPEN', description: 'Door', updatedAt: '2026-10-28T09:00:00.000Z', beforePhotoIds: [], afterPhotoIds: [] });
}

const roman = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate('roman', key, vars);

beforeEach(() => {
  mockRequest.mockReset();
  (syncFromApp as jest.Mock).mockClear();
  setServerApprovalsCount(null);
});

// ---------- helpers ----------

describe('who may approve', () => {
  it('owner, administrator, PM and PM + financials see "Meri approvals"; munshi and accountant do not', () => {
    const yes = ['owner', 'admin', 'pm', 'pmFin', 'verifier'] as const;
    const no = ['munshi', 'accountant'] as const;
    for (const k of yes) {
      expect(canApproveAnything(r(k).access, r(k).role)).toBe(true);
      expect(routeAllowed(r(k).access, r(k).role, '/approvals')).toBe(true);
    }
    for (const k of no) {
      expect(canApproveAnything(r(k).access, r(k).role)).toBe(false);
      expect(routeAllowed(r(k).access, r(k).role, '/approvals')).toBe(false);
    }
    // The server inbox needs approvals.inbox.view plus one of its approve keys.
    expect(canUseInbox(r('pm').access, 'PM')).toBe(true);
    expect(canUseInbox(r('owner').access, 'THEKEDAR')).toBe(true);
    expect(canUseInbox(r('munshi').access, 'MUNSHI')).toBe(false);
  });

  it('approval limits: the owner has none, a PM is stopped above his kharcha limit, a missing key is never within', () => {
    expect(approvalLimitOf(r('owner').access, 'THEKEDAR', 'cashbook.expense.approve')).toBeNull();
    expect(approvalLimitOf(r('pm').access, 'PM', 'cashbook.expense.approve')).toBe('5000000');
    expect(approvalLimitOf(r('pm').access, 'PM', 'labor.settlement.approve')).toBeNull();
    expect(approvalLimitOf(r('pm').access, 'PM', 'cashbook.topup.approve')).toBeUndefined();
    expect(withinLimit(r('pm').access, 'PM', 'cashbook.expense.approve', '5000000')).toBe(true);
    expect(withinLimit(r('pm').access, 'PM', 'cashbook.expense.approve', '5000001')).toBe(false);
    expect(withinLimit(r('owner').access, 'THEKEDAR', 'cashbook.expense.approve', '999999999999')).toBe(true);
    expect(withinLimit(r('pm').access, 'PM', 'cashbook.topup.approve', '1')).toBe(false);
  });

  it('fromServer keeps the kinds the phone handles and the person holds; marks approve above the limit', () => {
    const pm = fromServer(INBOX, r('pm').access, 'PM');
    expect(pm.map((i) => i.id)).toEqual(['st1', 'e-big', 'e-own', 'm1']); // no top-up key, invoices stay on the web
    const big = pm.find((i) => i.id === 'e-big')!;
    expect(big.actions.map((a) => [a.action, a.overLimit, a.needsNote])).toEqual([
      ['approve', true, false],
      ['reject', false, true],
    ]);
    expect(big.limitPaisa).toBe('5000000');
    expect(pm.find((i) => i.id === 'e-own')!.actions).toEqual([]); // own kharcha: the server sends no quick actions
    expect(pm.find((i) => i.id === 'st1')!.actions.map((a) => a.label)).toEqual(['appr.approve', 'appr.return']);

    const owner = fromServer(INBOX, r('owner').access, 'THEKEDAR');
    expect(owner.map((i) => i.id)).toEqual(['st1', 'e-big', 'e-own', 't1', 'm1']);
    expect(owner.find((i) => i.id === 't1')!.actions[0]).toMatchObject({ action: 'approve', needsMethod: true, label: 'appr.send', overLimit: false });
  });

  it('a measurement value (rate × quantity) is shown only with fields.rates', () => {
    expect(fromServer(INBOX, r('pm').access, 'PM').find((i) => i.id === 'm1')!.amountPaisa).toBe('6219000');
    const v = fromServer(INBOX, r('verifier').access, 'PM');
    expect(v.map((i) => i.id)).toEqual(['m1']);
    expect(v[0]!.amountPaisa).toBeNull();
  });

  it('local stoppages and fixed snags: synced ones only, and only with their approve keys', () => {
    seed('pm');
    const text = { t: roman, shortDate: (d: string) => d };
    expect(localApprovals(mockDb, r('pm').access, 'PM', text).map((i) => [i.kind, i.id])).toEqual([
      ['STOPPAGE_PENDING', 'sp1'],
      ['SNAG_TO_VERIFY', 'sn1'],
    ]);
    expect(localApprovals(mockDb, r('munshi').access, 'MUNSHI', text)).toEqual([]);
    expect(localApprovals(mockDb, r('accountant').access, 'PM', text)).toEqual([]);
  });
});

describe('runApproval (REST)', () => {
  const ok = { succeeded: 1, failed: 0, results: [{ ok: true, error: null }] };

  it('inbox kinds go through /approvals/bulk with one item', async () => {
    mockRequest.mockResolvedValueOnce(ok);
    await runApproval({ kind: 'TOPUP_PENDING', id: 't1' }, 'approve', { method: 'JAZZCASH' });
    expect(mockRequest).toHaveBeenCalledWith('/approvals/bulk', { method: 'POST', body: { items: [{ type: 'TOPUP_PENDING', id: 't1', action: 'approve', method: 'JAZZCASH' }] } });
  });

  it('a reject needs a reason of 3+ letters: nothing is sent without it', async () => {
    await expect(runApproval({ kind: 'EXPENSE_PENDING_APPROVAL', id: 'e1' }, 'reject', { note: ' no ' })).rejects.toMatchObject({ code: 'NOTE_REQUIRED' });
    expect(mockRequest).not.toHaveBeenCalled();
    mockRequest.mockResolvedValueOnce(ok);
    await runApproval({ kind: 'EXPENSE_PENDING_APPROVAL', id: 'e1' }, 'reject', { note: ' Bill nahi hai ' });
    expect(mockRequest.mock.calls[0][1].body.items[0]).toEqual({ type: 'EXPENSE_PENDING_APPROVAL', id: 'e1', action: 'reject', note: 'Bill nahi hai' });
  });

  it('a failed bulk item becomes an ApiError with the server code (APPROVAL_LIMIT_EXCEEDED → 403)', async () => {
    mockRequest.mockResolvedValueOnce({ succeeded: 0, failed: 1, results: [{ ok: false, error: { code: 'APPROVAL_LIMIT_EXCEEDED', message: 'above' } }] });
    const err = await runApproval({ kind: 'SETTLEMENT_SUBMITTED', id: 's1' }, 'approve').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'APPROVAL_LIMIT_EXCEEDED' });
  });

  it('stoppages and snags use their own endpoints (reopen sends `reason`)', async () => {
    mockRequest.mockResolvedValue({});
    await runApproval({ kind: 'STOPPAGE_PENDING', id: 'sp1' }, 'approve');
    await runApproval({ kind: 'STOPPAGE_PENDING', id: 'sp1' }, 'reject', { note: 'Barish nahi thi' });
    await runApproval({ kind: 'SNAG_TO_VERIFY', id: 'sn1' }, 'approve');
    await runApproval({ kind: 'SNAG_TO_VERIFY', id: 'sn1' }, 'reject', { note: 'Abhi bhi crack hai' });
    expect(mockRequest.mock.calls).toEqual([
      ['/stoppages/sp1/approve', { method: 'POST', body: {} }],
      ['/stoppages/sp1/reject', { method: 'POST', body: { note: 'Barish nahi thi' } }],
      ['/snags/sn1/verify', { method: 'POST', body: {} }],
      ['/snags/sn1/reopen', { method: 'POST', body: { reason: 'Abhi bhi crack hai' } }],
    ]);
  });
});

// ---------- screens ----------

const wrap = (el: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initial="roman">{el}</I18nProvider>
    </SafeAreaProvider>,
  );
const disabled = (testID: string) => !!screen.getByTestId(testID).props.accessibilityState?.disabled;

describe('entry points', () => {
  it.each(['owner', 'admin', 'pm', 'pmFin'] as const)('%s: "Meri approvals" on Mazeed with the count', async (who) => {
    seed(who);
    mockRequest.mockResolvedValue(INBOX);
    await wrap(<MazeedScreen />);
    await waitFor(() => expect(screen.getByTestId('open-approvals')).toBeTruthy());
  });

  it.each(['owner', 'admin', 'pm', 'pmFin'] as const)('%s: a "waiting for your approval" line on Aaj', async (who) => {
    seed(who);
    mockRequest.mockResolvedValue(INBOX);
    await wrap(<AajScreen />);
    await waitFor(() => expect(screen.getByTestId('aaj-approvals')).toBeTruthy());
  });

  it.each(['munshi', 'accountant'] as const)('%s: no approvals entry on Mazeed', async (who) => {
    seed(who);
    await wrap(<MazeedScreen />);
    expect(screen.queryByTestId('open-approvals')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it.each(['munshi', 'accountant'] as const)('%s: no approvals line on Aaj', async (who) => {
    seed(who);
    await wrap(<AajScreen />);
    expect(screen.queryByTestId('aaj-approvals')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('PM: the count adds the server inbox to the local stoppage + snag', async () => {
    seed('pm');
    mockRequest.mockResolvedValue(INBOX);
    await wrap(<AajScreen />);
    // 4 inbox items (no top-up key, no invoices) + 1 stoppage + 1 fixed snag
    await waitFor(() => expect(screen.getByText(roman('appr.pending', { n: 6 }))).toBeTruthy());
  });
});

describe('approvals screen', () => {
  it('PM: groups, project, amounts; approve above the limit is disabled with the reason', async () => {
    seed('pm');
    mockRequest.mockResolvedValue(INBOX);
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('approval-e-big')).toBeTruthy());
    for (const k of ['SETTLEMENT_SUBMITTED', 'EXPENSE_PENDING_APPROVAL', 'MEASUREMENT_TO_VERIFY', 'STOPPAGE_PENDING', 'SNAG_TO_VERIFY'] as const) expect(screen.getByText(roman(`appr.group.${k}`))).toBeTruthy();
    expect(screen.queryByText(roman('appr.group.TOPUP_PENDING'))).toBeNull();
    expect(disabled('approve-e-big')).toBe(true);
    expect(disabled('reject-e-big')).toBe(false);
    expect(screen.getByText(roman('appr.aboveLimit', { limit: 'Rs 50,000' }))).toBeTruthy();
    expect(disabled('approve-st1')).toBe(false);
    expect(screen.getAllByText(roman('appr.noQuick')).length).toBe(1); // own kharcha
  });

  it('approve → refreshes the list and runs a sync pull', async () => {
    seed('pm');
    mockRequest.mockImplementation(async (path: string) => (path === '/approvals' ? INBOX : { succeeded: 1, failed: 0, results: [{ ok: true, error: null }] }));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('approve-st1')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId('approve-st1')));
    await waitFor(() => expect(screen.getByText(roman('appr.done'))).toBeTruthy());
    expect(mockRequest).toHaveBeenCalledWith('/approvals/bulk', { method: 'POST', body: { items: [{ type: 'SETTLEMENT_SUBMITTED', id: 'st1', action: 'approve' }] } });
    expect(syncFromApp).toHaveBeenCalled();
    expect(mockRequest.mock.calls.filter((c) => c[0] === '/approvals').length).toBe(2);
    expect(screen.queryByTestId('approval-st1')).toBeNull();
  });

  it('reject asks for a reason; confirm stays disabled until it has 3 letters', async () => {
    seed('pm');
    mockRequest.mockImplementation(async (path: string) => (path === '/approvals' ? INBOX : { succeeded: 1, failed: 0, results: [{ ok: true, error: null }] }));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('reject-e-big')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId('reject-e-big')));
    expect(disabled('approval-confirm')).toBe(true);
    await act(async () => fireEvent.changeText(screen.getByTestId('approval-note'), 'ab'));
    expect(disabled('approval-confirm')).toBe(true);
    await act(async () => fireEvent.changeText(screen.getByTestId('approval-note'), 'Bill nahi laga'));
    expect(disabled('approval-confirm')).toBe(false);
    await act(async () => fireEvent.press(screen.getByTestId('approval-confirm')));
    expect(mockRequest).toHaveBeenCalledWith('/approvals/bulk', { method: 'POST', body: { items: [{ type: 'EXPENSE_PENDING_APPROVAL', id: 'e-big', action: 'reject', note: 'Bill nahi laga' }] } });
  });

  it('a snag is reopened with a reason through /snags/:id/reopen', async () => {
    seed('pm');
    mockRequest.mockImplementation(async (path: string) => (path === '/approvals' ? INBOX : {}));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('reject-sn1')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId('reject-sn1')));
    await act(async () => fireEvent.changeText(screen.getByTestId('approval-note'), 'Crack abhi bhi hai'));
    await act(async () => fireEvent.press(screen.getByTestId('approval-confirm')));
    expect(mockRequest).toHaveBeenCalledWith('/snags/sn1/reopen', { method: 'POST', body: { reason: 'Crack abhi bhi hai' } });
  });

  it('APPROVAL_LIMIT_EXCEEDED and PERMISSION_DENIED from the server are explained', async () => {
    seed('pmFin');
    let answer = 'APPROVAL_LIMIT_EXCEEDED';
    mockRequest.mockImplementation(async (path: string) => (path === '/approvals' ? INBOX : { succeeded: 0, failed: 1, results: [{ ok: false, error: { code: answer, message: 'x' } }] }));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('approve-e-big')).toBeTruthy());
    expect(disabled('approve-e-big')).toBe(false); // no limit stored on the phone: the server decides
    await act(async () => fireEvent.press(screen.getByTestId('approve-e-big')));
    await waitFor(() => expect(screen.getByText('Ye raqam aap ki manzoori ki had se zyada hai')).toBeTruthy());
    answer = 'PERMISSION_DENIED';
    await act(async () => fireEvent.press(screen.getByTestId('approve-st1')));
    await waitFor(() => expect(screen.getByText('Aap ko is ki ijazat nahi')).toBeTruthy());
    expect(syncFromApp).not.toHaveBeenCalled();
  });

  it('offline: says approving needs internet, still lists the synced stoppage / snag', async () => {
    seed('pm');
    mockRequest.mockRejectedValue(new NetworkError('network'));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('approvals-offline')).toBeTruthy());
    expect(screen.getByText(roman('appr.offline'))).toBeTruthy();
    expect(screen.getByTestId('approval-sp1')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('approve-sp1')));
    expect(screen.getAllByText(roman('appr.offline')).length).toBe(2);
  });

  it('owner: the top-up asks how the cash is sent', async () => {
    seed('owner');
    mockRequest.mockImplementation(async (path: string) => (path === '/approvals' ? INBOX : { succeeded: 1, failed: 0, results: [{ ok: true, error: null }] }));
    await wrap(<ApprovalsScreen />);
    await waitFor(() => expect(screen.getByTestId('approve-t1')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId('approve-t1')));
    expect(screen.getByText(roman('appr.sendBy'))).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('method-BANK')));
    await act(async () => fireEvent.press(screen.getByTestId('approval-confirm')));
    expect(mockRequest).toHaveBeenCalledWith('/approvals/bulk', { method: 'POST', body: { items: [{ type: 'TOPUP_PENDING', id: 't1', action: 'approve', method: 'BANK' }] } });
  });

  it.each(['munshi', 'accountant'] as const)('%s opening the route (a link / back stack) gets "Aap ko is ki ijazat nahi" and no request', async (who) => {
    seed(who);
    await wrap(<ApprovalsScreen />);
    expect(screen.getByText('Aap ko is ki ijazat nahi')).toBeTruthy();
    expect(screen.queryByTestId('approval-sp1')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('a person with approve keys but no inbox permission is told why wages / kharcha are missing', async () => {
    seed('pm');
    saveAccess(mockDb, { ...r('pm').access, permissions: r('pm').access.permissions.filter((k) => k !== 'approvals.inbox.view') });
    await wrap(<ApprovalsScreen />);
    expect(screen.getByTestId('approvals-no-inbox')).toBeTruthy();
    expect(screen.getByTestId('approval-sp1')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
