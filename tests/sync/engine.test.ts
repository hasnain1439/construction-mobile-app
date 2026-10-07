import { eq } from 'drizzle-orm';
import { NetworkError } from '../../src/api/client';
import { attachmentsQueue, outbox } from '../../src/db/schema';
import { getRow, listRows, putRow } from '../../src/db/store';
import { queueAttachment } from '../../src/sync/attachments';
import { resetEngineForTests, syncNow } from '../../src/sync/engine';
import { enqueue, pendingCount, problems } from '../../src/sync/outbox';
import { getSyncState, pullAll, setSyncState } from '../../src/sync/pull';
import { backoffMs, pushOutbox } from '../../src/sync/push';
import { testDb } from '../helpers/db';
import { FakeApi } from '../helpers/fakeApi';

const P = 'project-1';

function addExpense(db: ReturnType<typeof testDb>, amount: number, dependsOn?: string[]) {
  const clientId = `exp-${amount}`;
  return enqueue(db, {
    clientId,
    type: 'CASH_EXPENSE_CREATE',
    payload: { clientId, projectId: P, amountPaisa: amount },
    label: `Kharcha ${amount}`,
    dependsOn,
    writes: [{ table: 'cash_entries', row: { id: clientId, clientId, projectId: P, amountPaisa: amount } }],
  });
}

beforeEach(() => resetEngineForTests());

describe('outbox push', () => {
  it('sends in creation order with dependsOn and the pending header, then takes the server ids', async () => {
    const db = testDb();
    const w = enqueue(db, {
      clientId: 'w1',
      type: 'WORKER_CREATE',
      payload: { clientId: 'w1', name: 'Bashir' },
      label: 'Bashir',
      writes: [{ table: 'workers', row: { id: 'w1', clientId: 'w1', name: 'Bashir' } }],
    });
    enqueue(db, { clientId: 'a1', type: 'ATTENDANCE_UPSERT', payload: { workerId: w }, label: 'Hazri', dependsOn: [w] });
    addExpense(db, 500);
    const api = new FakeApi();
    const res = await pushOutbox(db, api);
    expect(res).toEqual({ sent: 3, applied: 3, rejected: 0, retry: 0 });
    expect(api.pushed[0]!.map((m) => m.clientId)).toEqual(['w1', 'a1', 'exp-500']);
    expect(api.pushed[0]![1]!.dependsOn).toEqual(['w1']);
    expect(api.pendingHeaders[0]).toBe(3);
    expect(getRow(db, 'workers', 'w1')).toBeNull();
    expect(getRow(db, 'workers', 'srv-w1')).toMatchObject({ id: 'srv-w1', name: 'Bashir' });
    expect(pendingCount(db)).toBe(0);
  });

  it('treats DUPLICATE as done (a retried batch the server already applied)', async () => {
    const db = testDb();
    addExpense(db, 700);
    const api = new FakeApi();
    api.decide = (m) => ({ status: 'DUPLICATE', serverId: `srv-${m.clientId}` });
    const res = await pushOutbox(db, api);
    expect(res.applied).toBe(1);
    expect(db.select().from(outbox).get()!.status).toBe('APPLIED');
    expect(getRow(db, 'cash_entries', 'srv-exp-700')).not.toBeNull();
    expect(problems(db)).toHaveLength(0);
  });

  it('rolls back a REJECTED change (new row removed, edited row restored) and lists it under problems', async () => {
    const db = testDb();
    putRow(db, 'project_workers', { id: 'pw1', projectId: P, dailyWagePaisa: 100 });
    enqueue(db, {
      clientId: 'edit',
      type: 'PROJECT_WORKER_ASSIGN',
      payload: {},
      label: 'Assign',
      writes: [{ table: 'project_workers', row: { id: 'pw1', projectId: P, dailyWagePaisa: 999 } }],
    });
    addExpense(db, 900);
    const api = new FakeApi();
    api.decide = () => ({ status: 'REJECTED', error: { code: 'PROJECT_CLOSED', message: 'closed' } });
    const res = await pushOutbox(db, api);
    expect(res.rejected).toBe(2);
    expect(getRow(db, 'project_workers', 'pw1')).toMatchObject({ dailyWagePaisa: 100 });
    expect(getRow(db, 'cash_entries', 'exp-900')).toBeNull();
    const p = problems(db);
    expect(p.map((x) => x.clientId)).toEqual(['exp-900', 'edit']);
    expect(JSON.parse(p[0]!.lastError!)).toMatchObject({ code: 'PROJECT_CLOSED' });
  });

  it('RETRY stops the batch: later items wait, back-off grows and the ready prefix is respected', async () => {
    const db = testDb();
    addExpense(db, 1);
    addExpense(db, 2);
    const api = new FakeApi();
    api.decide = (m) => (m.clientId === 'exp-1' ? { status: 'RETRY', error: { code: 'SERVICE_BUSY', message: '' } } : { status: 'RETRY', error: { code: 'EARLIER_RETRY', message: '' } });
    await pushOutbox(db, api, { now: 1000 });
    const rows = db.select().from(outbox).all();
    expect(rows.every((r) => r.status === 'PENDING' && r.attempts === 1 && r.nextAttemptAt === 1000 + backoffMs(1))).toBe(true);
    // Too early: nothing is sent.
    await pushOutbox(db, api, { now: 2000 });
    expect(api.pushed).toHaveLength(1);
    expect(backoffMs(1)).toBe(15_000);
    expect(backoffMs(20)).toBe(30 * 60_000);
  });

  it('keeps everything on a network failure', async () => {
    const db = testDb();
    addExpense(db, 3);
    const api = new FakeApi();
    api.pushError = new NetworkError('offline');
    await expect(pushOutbox(db, api, { now: 0 })).rejects.toBeInstanceOf(NetworkError);
    expect(db.select().from(outbox).get()).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(getRow(db, 'cash_entries', 'exp-3')).not.toBeNull();
  });
});

describe('pull', () => {
  it('applies upserts and tombstones, leaves rows of pending mutations alone, drops optimistic copies', async () => {
    const db = testDb();
    putRow(db, 'materials', { id: 'm1', name: 'Cement' });
    putRow(db, 'materials', { id: 'm2', name: 'Sariya' });
    addExpense(db, 10); // pending, local row exp-10
    putRow(db, 'attendance', { id: 'local-att', projectId: P, workerId: 'w', date: '2026-10-05', status: 'PRESENT' }, true);
    const api = new FakeApi()
      .page({ materials: { upserts: [{ id: 'm1', name: 'Cement OPC' }], deletes: ['m2'] } }, { hasMore: true })
      .page({
        cash_entries: { upserts: [{ id: 'exp-10', projectId: P, amountPaisa: 1 }], deletes: [] },
        attendance: { upserts: [{ id: 'srv-att', projectId: P, workerId: 'w', date: '2026-10-05', status: 'HALF' }], deletes: [] },
      });
    // Start from an existing cursor (incremental).
    setSyncState(db, { cursor: '0' });
    await syncNow(db, { ...api, push: async () => ({ results: [] }), pull: api.pull.bind(api), upload: api.upload.bind(api) }, { now: () => 5 });
    expect(getRow(db, 'materials', 'm1')).toMatchObject({ name: 'Cement OPC' });
    expect(getRow(db, 'materials', 'm2')).toBeNull();
    // The expense is still waiting for its push, so the pulled copy did not overwrite it.
    expect(getRow(db, 'cash_entries', 'exp-10')).toMatchObject({ amountPaisa: 10 });
    expect(listRows(db, 'attendance').map((r) => r.id)).toEqual(['srv-att']);
    expect(getSyncState(db).cursor).toBe('2');
    expect(api.pullCursors).toEqual(['0', '1']);
  });

  it('a server row carrying a clientId replaces the optimistic copy after the push', async () => {
    const db = testDb();
    addExpense(db, 20);
    const api = new FakeApi();
    api.decide = () => ({ status: 'APPLIED', serverId: 'e-20' });
    api.page({ cash_entries: { upserts: [{ id: 'e-20', clientId: 'exp-20', projectId: P, amountPaisa: 20 }], deletes: [] } });
    const st = await syncNow(db, api);
    expect(st.phase).toBe('idle');
    expect(listRows(db, 'cash_entries').map((r) => r.id)).toEqual(['e-20']);
  });

  it('resetRequired wipes the mirror and pulls a fresh snapshot, keeping unsent work', async () => {
    const db = testDb();
    putRow(db, 'projects', { id: 'old-project' });
    putRow(db, 'workers', { id: 'gone' });
    const api = new FakeApi()
      .page({}, { resetRequired: true })
      .page({ projects: { upserts: [{ id: P, name: 'DHA' }], deletes: [] } }, { cursor: '42' });
    api.pushError = new NetworkError('offline');
    addExpense(db, 30);
    // Push fails (offline) → nothing pulled; then the network is back.
    expect((await syncNow(db, api)).phase).toBe('offline');
    api.pushError = null;
    api.decide = () => ({ status: 'RETRY', error: { code: 'SERVICE_BUSY', message: '' } });
    db.update(outbox).set({ nextAttemptAt: 0 }).run();
    setSyncState(db, { cursor: '7' });
    await syncNow(db, api);
    expect(api.pullCursors).toEqual(['7', undefined]);
    expect(listRows(db, 'projects').map((r) => r.id)).toEqual([P]);
    expect(listRows(db, 'workers')).toHaveLength(0);
    expect(getSyncState(db).cursor).toBe('42');
    expect(pendingCount(db)).toBe(1);
    expect(getRow(db, 'cash_entries', 'exp-30')).not.toBeNull();
  });

  it('a snapshot replaces server rows but keeps rows made on the phone', async () => {
    const db = testDb();
    putRow(db, 'materials', { id: 'stale' });
    addExpense(db, 40);
    const api = new FakeApi().page({ materials: { upserts: [{ id: 'fresh' }], deletes: [] }, cash_entries: { upserts: [], deletes: [] } });
    api.pushError = new NetworkError('x');
    await syncNow(db, api, { pushOnly: false });
    // Push failed first → pull did not run; run a pull directly.
    await pullAll(db, api);
    expect(listRows(db, 'materials').map((r) => r.id)).toEqual(['fresh']);
    expect(getRow(db, 'cash_entries', 'exp-40')).not.toBeNull();
  });
});

describe('attachments', () => {
  it('uploads queued files before pushing the mutation that uses them', async () => {
    const db = testDb();
    const photo = queueAttachment(db, { localUri: 'file:///p.jpg', kind: 'SITE_PHOTO', mimeType: 'image/jpeg' });
    enqueue(db, { clientId: 'log', type: 'DAILY_LOG_UPSERT', payload: { photoIds: [photo] }, label: 'Log' });
    const order: string[] = [];
    const api = new FakeApi();
    const up = api.upload.bind(api);
    const push = api.push.bind(api);
    api.upload = async (i) => (order.push('upload'), up(i));
    api.push = async (m, n) => (order.push('push'), push(m, n));
    await syncNow(db, api);
    expect(order).toEqual(['upload', 'push']);
    expect(db.select().from(attachmentsQueue).where(eq(attachmentsQueue.clientId, photo)).get()).toMatchObject({ status: 'UPLOADED', serverId: `att-${photo}` });
  });

  it('a failed upload stops the run when offline (nothing pushed that references it)', async () => {
    const db = testDb();
    queueAttachment(db, { localUri: 'file:///v.m4a', kind: 'VOICE_NOTE', mimeType: 'audio/mp4' });
    addExpense(db, 50);
    const api = new FakeApi();
    api.uploadError = new NetworkError('offline');
    const st = await syncNow(db, api);
    expect(st.phase).toBe('offline');
    expect(api.pushed).toHaveLength(0);
    expect(st.pending).toBe(1);
    expect(st.pendingUploads).toBe(1);
  });

  it('only one sync runs at a time', async () => {
    const db = testDb();
    const api = new FakeApi();
    const spy = jest.spyOn(api, 'pull');
    const [a, b] = await Promise.all([syncNow(db, api), syncNow(db, api)]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
