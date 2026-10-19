/**
 * Owner decisions 3 and 4 on the phone.
 * 4 — `fields.wages`: without it the server leaves worker / type / settlement-line rates out of the
 *     pull (key missing) and rejects a WORKER_CREATE that carries a rate. The app must store those
 *     rows, never show a rate (no "Rs 0" / NaN), keep the server's wage totals, and send no rate.
 * 3 — equipment rupee values: the equipment tables carry counts only (money keys are not stored).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HazriScreen from '../app/(tabs)/hazri';
import SettlementScreen from '../app/hazri/settlement';
import NewWorkerScreen from '../app/hazri/worker-new';
import { readAccess, saveAccess } from '../src/db/access';
import { getRow, listRows } from '../src/db/store';
import type { Db } from '../src/db/types';
import type { Ctx } from '../src/features/actions';
import type { SettlementRow, WorkerRow, WorkerTypeRow } from '../src/features/types';
import { workerTypeOptions } from '../src/features/workerTypes';
import { I18nProvider } from '../src/i18n';
import { todayPK, weekOf } from '../src/lib/dates';
import { accessFrom, can, canSeeWages, rules, visibleRate, type Access } from '../src/lib/permissions';
import { pendingItems } from '../src/sync/outbox';
import { pullAll, withoutMoney } from '../src/sync/pull';
import { testDb } from './helpers/db';
import { FakeApi } from './helpers/fakeApi';

jest.setTimeout(30000);

const P = 'p1';
let mockDb: Db;
let mockRole = 'MUNSHI';
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

const LABOUR_KEYS = ['labor.attendance.view', 'labor.attendance.create', 'masterdata.worker.create', 'masterdata.worker.view', 'masterdata.laborrate.view', 'labor.team.view', 'labor.settlement.view', 'labor.settlement.create'];
const fieldAccess = (over: Partial<Access['fieldAccess']> = {}) => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
/** Default munshi: wages ON (decision 4 keeps today's behaviour), no rates. */
const MUNSHI: Access = { permissions: [...LABOUR_KEYS, 'fields.wages'], fieldAccess: fieldAccess() };
/** The company turned the toggle off for this person. */
const NO_WAGES: Access = { permissions: LABOUR_KEYS, fieldAccess: fieldAccess({ wages: false }) };

const week = weekOf(todayPK(), 'MONDAY').weekStart;
const TYPE = { id: 'wt-1', key: 'MISTRI', label: 'Mason', labelRoman: 'Mistri', labelUrdu: 'مستری', overtimeMultiplier: null, isActive: true, updatedAt: '2026-10-01T09:00:00.000Z' };
const WORKER = { id: 'w1', name: 'Bashir Ahmed', type: 'MISTRI', phone: null, isActive: true };
const PW = { id: 'pw1', projectId: P, workerId: 'w1', startDate: '2026-10-01', endDate: null, isActive: true };
const LINE = { id: 'l1', workerId: 'w1', fullDays: 5, halfDays: 1, daysWorked: 5.5, overtimeHours: null, overtimePaisa: '0', grossPaisa: '1540000', advanceAdjustedPaisa: '0', netPaisa: '1540000', paymentStatus: 'UNPAID', paidFrom: null };
const SETTLEMENT = { id: 's1', projectId: P, weekStart: week, weekEnd: week, status: 'DRAFT', grossPaisa: '1540000', advancePaisa: '0', netPaisa: '1540000', paidPaisa: '0', returnComment: null };

/** One pull as the server sends it; `rates` = the person holds fields.wages (rate keys present). */
function serverPage(rates: boolean, access: Access) {
  const r = <T extends object>(row: T, key: string, value: string) => (rates ? { ...row, [key]: value } : row);
  return new FakeApi().page(
    {
      worker_types: { upserts: [r(TYPE, 'ratePaisa', '280000')], deletes: [] },
      workers: { upserts: [r(WORKER, 'dailyRatePaisa', '280000')], deletes: [] },
      project_workers: { upserts: [r(PW, 'dailyRatePaisa', '280000')], deletes: [] },
      settlements: { upserts: [{ ...SETTLEMENT, lines: [r(LINE, 'dailyRatePaisa', '280000')] }], deletes: [] },
    },
    { access: access as never },
  );
}

async function pulled(rates: boolean, access: Access) {
  mockDb = testDb();
  await pullAll(mockDb, serverPage(rates, access));
}

const wrap = (el: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initial="roman">{el}</I18nProvider>
    </SafeAreaProvider>,
  );
type Node = { children?: (Node | string)[] | null } | string | null;
const textOf = (n: Node | Node[]): string => (n === null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join(' ') : (n.children ?? []).map(textOf).join(' '));
/** Every text on screen (the rendered tree, not props). */
const allText = () => textOf(screen.toJSON() as Node | Node[]);

beforeEach(() => {
  mockRole = 'MUNSHI';
});

describe('fields.wages (decision 4) — permission helpers', () => {
  it('reads fieldAccess.wages and the key; an older server without it leaves the decision to the rows', () => {
    expect(canSeeWages(MUNSHI, 'MUNSHI')).toBe(true);
    expect(canSeeWages(NO_WAGES, 'MUNSHI')).toBe(false);
    expect(can({ ...NO_WAGES, permissions: [...LABOUR_KEYS, 'fields.wages'] }, 'PM', 'fields.wages')).toBe(true);
    const old = accessFrom({ permissions: LABOUR_KEYS, fieldAccess: { rates: false, amounts: false, profit: false, contract: false } })!;
    expect(old.fieldAccess).not.toHaveProperty('wages');
    expect(canSeeWages(old, 'MUNSHI')).toBe(true);
    expect(canSeeWages(null, 'MUNSHI')).toBe(true);
    expect(canSeeWages(NO_WAGES, 'THEKEDAR')).toBe(true);
    expect(accessFrom({ permissions: [], fieldAccess: fieldAccess({ wages: false }) })!.fieldAccess.wages).toBe(false);
  });

  it('a rate is shown only with the key AND a value in the row', () => {
    expect(visibleRate(MUNSHI, 'MUNSHI', '280000')).toBe('280000');
    expect(visibleRate(MUNSHI, 'MUNSHI', undefined)).toBeNull();
    expect(visibleRate(MUNSHI, 'MUNSHI', null)).toBeNull();
    expect(visibleRate(MUNSHI, 'MUNSHI', '')).toBeNull();
    expect(visibleRate(NO_WAGES, 'MUNSHI', '280000')).toBeNull();
  });

  it('setting a worker rate needs fields.rates and fields.wages', () => {
    const pm: Access = { permissions: [...LABOUR_KEYS, 'fields.rates', 'fields.wages'], fieldAccess: fieldAccess({ rates: true }) };
    expect(rules.setWorkerRate(pm, 'PM')).toBe(true);
    expect(rules.setWorkerRate({ ...pm, permissions: [...LABOUR_KEYS, 'fields.rates'], fieldAccess: fieldAccess({ rates: true, wages: false }) }, 'PM')).toBe(false);
    expect(rules.setWorkerRate(MUNSHI, 'MUNSHI')).toBe(false);
  });
});

describe('pull without fields.wages (rates absent)', () => {
  it('stores workers, team, types and settlement lines without the rate keys and the access block', async () => {
    await pulled(false, NO_WAGES);
    expect(getRow<WorkerRow>(mockDb, 'workers', 'w1')).toEqual(WORKER);
    expect(getRow(mockDb, 'project_workers', 'pw1')).toEqual(PW);
    const types = listRows<WorkerTypeRow>(mockDb, 'worker_types');
    expect(types[0]).not.toHaveProperty('ratePaisa');
    expect(workerTypeOptions(types, 'roman').find((o) => o.key === 'MISTRI')!.ratePaisa).toBeNull();
    const s = getRow<SettlementRow>(mockDb, 'settlements', 's1')!;
    expect(s.lines[0]).not.toHaveProperty('dailyRatePaisa');
    expect(s.lines[0]!.netPaisa).toBe('1540000');
    expect(readAccess(mockDb)!.fieldAccess.wages).toBe(false);
  });

  it('weekly wages still shows the server’s totals — no rate, no Rs 0, no NaN', async () => {
    await pulled(false, NO_WAGES);
    await wrap(<SettlementScreen />);
    const text = allText();
    expect(text).toContain('Bashir Ahmed');
    expect(text).toContain('Rs 15,400');
    expect(text).not.toMatch(/Rs 2,800|Rs 0\b|NaN|undefined/);
  });

  it('hazri lists the worker without a rate', async () => {
    await pulled(false, NO_WAGES);
    await wrap(<HazriScreen />);
    const text = allText();
    expect(text).toContain('Bashir Ahmed');
    expect(text).not.toMatch(/Rs\b|NaN|undefined/);
  });

  it('Naya mazdoor shows no rate input and sends no dailyRatePaisa (even for a PM with fields.rates)', async () => {
    mockRole = 'PM';
    await pulled(false, { ...NO_WAGES, permissions: [...LABOUR_KEYS, 'fields.rates'], fieldAccess: fieldAccess({ rates: true, wages: false }) });
    await wrap(<NewWorkerScreen />);
    expect(screen.queryByTestId('worker-rate')).toBeNull();
    await fireEvent.press(screen.getByTestId('worker-type-MISTRI'));
    await fireEvent.changeText(screen.getByTestId('worker-name'), 'Nadeem');
    await fireEvent.press(screen.getByTestId('save-worker'));
    const [create, assign] = pendingItems(mockDb).map((m) => JSON.parse(m.payload) as Record<string, unknown>);
    expect(create).toEqual({ name: 'Nadeem', type: 'MISTRI' });
    expect(assign).not.toHaveProperty('dailyRatePaisa');
    const local = listRows<WorkerRow>(mockDb, 'workers').find((w) => w.name === 'Nadeem')!;
    expect(local.dailyRatePaisa).toBeNull();
  });
});

describe('pull with fields.wages (default — unchanged)', () => {
  it('keeps the rates; weekly wages renders as before', async () => {
    await pulled(true, MUNSHI);
    expect(getRow<WorkerRow>(mockDb, 'workers', 'w1')!.dailyRatePaisa).toBe('280000');
    expect(getRow<SettlementRow>(mockDb, 'settlements', 's1')!.lines[0]!.dailyRatePaisa).toBe('280000');
    expect(visibleRate(readAccess(mockDb), 'MUNSHI', listRows<WorkerTypeRow>(mockDb, 'worker_types')[0]!.ratePaisa)).toBe('280000');
    await wrap(<SettlementScreen />);
    expect(allText()).toContain('Rs 15,400');
  });

  it('a PM with fields.rates + fields.wages gets the type’s rate filled in and sends it', async () => {
    mockRole = 'PM';
    await pulled(true, { permissions: [...LABOUR_KEYS, 'fields.rates', 'fields.wages'], fieldAccess: fieldAccess({ rates: true }) });
    await wrap(<NewWorkerScreen />);
    await fireEvent.press(screen.getByTestId('worker-type-MISTRI'));
    expect(screen.getByTestId('worker-rate').props.value).toBe('2800');
    await fireEvent.changeText(screen.getByTestId('worker-name'), 'Nadeem');
    await fireEvent.press(screen.getByTestId('save-worker'));
    expect(JSON.parse(pendingItems(mockDb)[0]!.payload)).toEqual({ name: 'Nadeem', type: 'MISTRI', dailyRatePaisa: '280000' });
  });

  it('a default munshi (wages ON, no fields.rates) still sets no rate', async () => {
    await pulled(true, MUNSHI);
    saveAccess(mockDb, MUNSHI);
    await wrap(<NewWorkerScreen />);
    expect(screen.queryByTestId('worker-rate')).toBeNull();
  });
});

describe('equipment carries no money (decision 3)', () => {
  it('money keys a server might send are not stored in the equipment tables', async () => {
    mockDb = testDb();
    const api = new FakeApi().page({
      equipment: { upserts: [{ id: 'eq1', code: 'MX-01', name: 'Mixer', kind: 'MACHINE', category: 'MIXER', unit: 'nos', isActive: true, hireRatePaisaPerDay: '250000', replacementValuePaisa: '45000000' }], deletes: [] },
      equipment_rentals: {
        upserts: [{ id: 'r1', number: 'ER-1', status: 'ACTIVE', supplierName: 'Ali Scaffolding', projectId: P, locationId: 'loc', startDate: '2026-10-01', expectedEndDate: null, depositPaisa: '500000', rentToDatePaisa: '120000', items: [{ id: 'ri1', equipmentId: 'eq1', qty: 10, returnedQty: 0, missingQty: 0, ratePaisaPerDay: '2000' }] }],
        deletes: [],
      },
      equipment_losses: { upserts: [{ id: 'el1', number: 'EL-1', kind: 'MISSING', status: 'CHARGED', equipmentId: 'eq1', qty: 1, valuePaisa: '45000000', chargePaisa: '45000000' }], deletes: [] },
      workers: { upserts: [{ ...WORKER, dailyRatePaisa: '280000' }], deletes: [] },
    });
    await pullAll(mockDb, api);
    const stored = JSON.stringify([listRows(mockDb, 'equipment'), listRows(mockDb, 'equipment_rentals'), listRows(mockDb, 'equipment_losses')]);
    expect(stored).not.toMatch(/Paisa|deposit|charge"|45000000|250000/);
    expect(stored).toContain('"status":"CHARGED"');
    expect(listRows(mockDb, 'equipment_rentals')[0]).toMatchObject({ supplierName: 'Ali Scaffolding', items: [{ qty: 10 }] });
    // Other tables are stored as sent (wages follow fields.wages on the server).
    expect(getRow<WorkerRow>(mockDb, 'workers', 'w1')!.dailyRatePaisa).toBe('280000');
  });

  it('withoutMoney leaves counts and statuses alone', () => {
    expect(withoutMoney({ id: 'x', qty: 2, status: 'CHARGED', items: [{ sentQty: 3, hireRatePaisaPerDay: '1' }], idleCostPaisa: '9' })).toEqual({ id: 'x', qty: 2, status: 'CHARGED', items: [{ sentQty: 3 }] });
  });
});
