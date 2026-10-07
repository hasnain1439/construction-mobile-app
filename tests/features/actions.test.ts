import { outbox } from '../../src/db/schema';
import { getRow, listRows, putRow } from '../../src/db/store';
import { acknowledgeFloat, addExpense, addWorker, giveAdvance, markAttendance, pendingDeps, receiveDispatch, recordUsage, saveDailyLog, sitePurchase } from '../../src/features/actions';
import { cashAccount, siteStock, siteWorkers, weekLocked } from '../../src/features/queries';
import type { CashEntryRow, DispatchRow } from '../../src/features/types';
import { resetEngineForTests, syncNow } from '../../src/sync/engine';
import { pendingItems, problems } from '../../src/sync/outbox';
import { testDb } from '../helpers/db';
import { FakeApi } from '../helpers/fakeApi';

const P = '11111111-1111-4111-8111-111111111111';
const LOC = 'loc-site';
const ctx = { userId: 'u-rafaqat', userName: 'Rafaqat', now: new Date('2026-10-06T09:00:00+05:00') };

function seed() {
  const db = testDb();
  putRow(db, 'projects', { id: P, name: 'DHA House', code: 'P-1', status: 'ACTIVE' });
  putRow(db, 'stock_locations', { id: LOC, type: 'SITE', name: 'DHA site', projectId: P });
  putRow(db, 'materials', { id: 'cement', name: 'Cement', unit: 'bag', groupId: 'g', supplyCategory: 'CONTRACTOR', isHidden: false });
  putRow(db, 'site_stock', { id: `${LOC}:cement`, locationId: LOC, materialId: 'cement', quantity: 40, ownerQuantity: 0 });
  putRow(db, 'cash_accounts', { id: 'acc', name: 'Rafaqat', isActive: true, balancePaisa: '1000000', pendingAckPaisa: '500000', pendingApprovalPaisa: '0', recoverablePaisa: '0' });
  putRow(db, 'settings', { id: 't', blindCountEnabled: true, kharchaApprovalLimitPaisa: '2500000', workingDays: [], settlementWeekStart: 'MONDAY', hoursPerDay: 8, missingLogAlertTime: '18:00' });
  return db;
}

beforeEach(() => resetEngineForTests());

describe('hazri offline', () => {
  it('a new worker can be marked present before anything was sent; the hazri waits for the worker', async () => {
    const db = seed();
    const w = addWorker(db, ctx, { projectId: P, name: 'Bashir', type: 'MAZDOOR' });
    expect(siteWorkers(db, P).map((x) => x.worker.name)).toEqual(['Bashir']);
    const hazri = markAttendance(db, ctx, { projectId: P, date: '2026-10-06', entries: [{ workerId: w, status: 'FULL', overtimeHours: 2 }] });
    const items = pendingItems(db);
    expect(items.map((i) => i.type)).toEqual(['WORKER_CREATE', 'PROJECT_WORKER_ASSIGN', 'ATTENDANCE_UPSERT']);
    expect(JSON.parse(items[1]!.dependsOn)).toEqual([w]);
    expect(JSON.parse(items.find((i) => i.clientId === hazri)!.dependsOn)).toEqual([w]);
    expect(JSON.parse(items[2]!.payload)).toEqual({ projectId: P, date: '2026-10-06', entries: [{ workerId: w, status: 'FULL', overtimeHours: 2 }] });

    // The server applies all three; the worker gets its server id.
    const api = new FakeApi();
    await syncNow(db, api, { now: () => ctx.now.getTime() });
    expect(api.pushed[0]!.map((m) => m.type)).toEqual(['WORKER_CREATE', 'PROJECT_WORKER_ASSIGN', 'ATTENDANCE_UPSERT']);
    expect(getRow(db, 'workers', `srv-${w}`)).toMatchObject({ name: 'Bashir' });
    expect(pendingDeps(db, [w])).toEqual([]);
  });

  it('changing an already-synced hazri overwrites that row and restores it when refused', async () => {
    const db = seed();
    putRow(db, 'attendance', { id: 'att-1', projectId: P, workerId: 'w1', date: '2026-10-06', status: 'FULL', overtimeHours: 0 });
    markAttendance(db, ctx, { projectId: P, date: '2026-10-06', entries: [{ workerId: 'w1', status: 'HALF' }] });
    expect(listRows(db, 'attendance')).toEqual([expect.objectContaining({ id: 'att-1', status: 'HALF', pendingSync: true })]);
    const api = new FakeApi();
    api.decide = () => ({ status: 'REJECTED', error: { code: 'WEEK_LOCKED', message: 'locked' } });
    await syncNow(db, api);
    expect(getRow(db, 'attendance', 'att-1')).toMatchObject({ status: 'FULL' });
    expect(problems(db)).toHaveLength(1);
  });

  it('a week is locked once its wages are sent for approval', () => {
    const db = seed();
    putRow(db, 'settlements', { id: 's1', projectId: P, weekStart: '2026-10-05', weekEnd: '2026-10-11', status: 'SUBMITTED', lines: [] });
    expect(weekLocked(db, P, '2026-10-06')).toBe(true);
    expect(weekLocked(db, P, '2026-10-04')).toBe(false);
  });
});

describe('cash', () => {
  it('kharcha drops the balance at once; above the limit it waits for approval; a refusal puts the money back', async () => {
    const db = seed();
    addExpense(db, ctx, { projectId: P, category: 'TEA_WATER', amountPaisa: '50000', description: 'Chai', date: '2026-10-06' });
    expect(cashAccount(db)!.balancePaisa).toBe('950000');
    const big = addExpense(db, ctx, { projectId: P, category: 'FUEL', amountPaisa: '3000000', description: 'Diesel', date: '2026-10-06' });
    expect(getRow<CashEntryRow>(db, 'cash_entries', big)).toMatchObject({ status: 'PENDING_APPROVAL', amountPaisa: '-3000000' });
    expect(cashAccount(db)).toMatchObject({ balancePaisa: '-2050000', pendingApprovalPaisa: '3000000' });

    const api = new FakeApi();
    api.decide = (m) => (m.clientId === big ? { status: 'REJECTED', error: { code: 'INSUFFICIENT_CASH', message: '' } } : { status: 'APPLIED', serverId: `srv-${m.clientId}` });
    await syncNow(db, api);
    expect(getRow(db, 'cash_entries', big)).toBeNull();
    expect(cashAccount(db)!.balancePaisa).toBe('950000');
  });

  it('confirming a float moves it into the balance; peshgi is paid from site cash', () => {
    const db = seed();
    const float: CashEntryRow = { id: 'f1', accountId: 'acc', projectId: P, type: 'FLOAT_IN', amountPaisa: '500000', category: null, description: 'Float', status: 'PENDING_ACK', method: 'CASH', reviewNote: null, recoverableFromHolder: false, attachmentId: null, clientId: null, occurredAt: null };
    putRow(db, 'cash_entries', float);
    acknowledgeFloat(db, ctx, float);
    expect(cashAccount(db)).toMatchObject({ balancePaisa: '1500000', pendingAckPaisa: '0' });
    giveAdvance(db, ctx, { projectId: P, payeeType: 'WORKER', workerId: 'w1', amountPaisa: '200000', date: '2026-10-06', label: 'Peshgi' });
    expect(cashAccount(db)!.balancePaisa).toBe('1300000');
    expect(JSON.parse(pendingItems(db)[1]!.payload)).toMatchObject({ paidFrom: 'SITE_CASH', workerId: 'w1', amountPaisa: '200000' });
  });
});

describe('maal', () => {
  it('receiving a dispatch adds the good quantity to site stock; usage takes it out', () => {
    const db = seed();
    const d: DispatchRow = { id: 'd1', number: 'GP-1', status: 'ON_THE_WAY', projectId: P, toLocationId: LOC, from: 'Store', vehicleNo: null, driverName: null, driverPhone: null, dispatchedAt: null, receivedAt: null, blindCount: true, items: [{ id: 'i1', materialId: 'cement', damagedQty: null, note: null }] };
    putRow(db, 'dispatches', d);
    receiveDispatch(db, ctx, d, [{ materialId: 'cement', received: 100, damaged: 2, note: 'two torn' }]);
    expect(siteStock(db, P)[0]!.quantity).toBe(138);
    expect(getRow(db, 'dispatches', 'd1')).toMatchObject({ status: 'RECEIVED', pendingSync: true });
    expect(JSON.parse(pendingItems(db)[0]!.payload)).toEqual({ dispatchId: 'd1', items: [{ materialId: 'cement', receivedQty: '100', damagedQty: '2', note: 'two torn' }] });
    recordUsage(db, ctx, { projectId: P, date: '2026-10-06', items: [{ materialId: 'cement', qty: 12.5 }] });
    expect(siteStock(db, P)[0]!.quantity).toBe(125.5);
  });

  it('a site purchase sends no rates — only supplier id, challan, photo and quantities', () => {
    const db = seed();
    sitePurchase(db, ctx, { projectId: P, supplier: { id: 's1', name: 'Ali Traders' }, challanNo: 'CH-9', date: '2026-10-06', challanPhotoId: 'photo-1', items: [{ materialId: 'cement', qty: 10 }] });
    const payload = JSON.parse(pendingItems(db)[0]!.payload) as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toMatch(/rate|Paisa|amount/i);
    expect(payload).toMatchObject({ deliverTo: 'SITE', challanAttachmentId: 'photo-1', supplierId: 's1' });
  });
});

describe('daily log', () => {
  it('saving twice the same day updates one log; the second save waits for the first', () => {
    const db = seed();
    const first = saveDailyLog(db, ctx, { projectId: P, conditions: ['RAIN'], photoIds: [], voiceIds: [] });
    const second = saveDailyLog(db, { ...ctx, now: new Date(ctx.now.getTime() + 60_000) }, { projectId: P, conditions: ['RAIN', 'CURING'], workDone: 'Curing', photoIds: ['p1'], voiceIds: ['v1'] });
    const logs = listRows(db, 'daily_logs');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: first, conditions: ['RAIN', 'CURING'], photoAttachmentIds: ['p1'] });
    const item = db.select().from(outbox).all().find((i) => i.clientId === second)!;
    expect(JSON.parse(item.dependsOn)).toEqual([first]);
  });
});
