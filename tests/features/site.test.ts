/**
 * Steps 13, 15, 16, 17 on the phone: the new pull tables are stored, the push builders send the
 * contract payloads (never money), the validation rules match the server and photos go first.
 */
import { outbox } from '../../src/db/schema';
import { getRow, listRows, putRow } from '../../src/db/store';
import { recordUsage } from '../../src/features/actions';
import { assigneeOptions, checkFix, checkInstruction, checkSnag, createSnag, drawingsByFolder, fixSnag, isOverdue, recordInstruction, siteInstructions, snags } from '../../src/features/closeout';
import { extensionOf, isImage } from '../../src/features/drawingCache';
import { checkLoss, checkReceiveLine, hidesSentQty, incomingEquipment, receiveEquipment, reportEquipmentLoss, siteEquipment } from '../../src/features/equipment';
import { milestoneLabel } from '../../src/features/labels';
import { checkProgress, checkStoppage, isLate, logStoppage, openMilestones, statusChoices, todayMilestones, updateMilestone } from '../../src/features/schedule';
import type { EquipmentTransferRow, MilestoneRow, SnagRow, StoppageRow } from '../../src/features/types';
import { queueAttachment } from '../../src/sync/attachments';
import { resetEngineForTests, syncNow } from '../../src/sync/engine';
import { pendingItems } from '../../src/sync/outbox';
import { pullAll, setSyncState } from '../../src/sync/pull';
import { testDb } from '../helpers/db';
import { FakeApi } from '../helpers/fakeApi';

jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));

const P = '11111111-1111-4111-8111-111111111111';
const LOC = 'loc-site';
const YARD = 'loc-yard';
const ctx = { userId: 'u-rafaqat', userName: 'Rafaqat', now: new Date('2026-10-16T09:00:00+05:00') };
const TODAY = '2026-10-16';

const milestone = (over: Partial<MilestoneRow> = {}): MilestoneRow => ({
  id: 'ms-walls',
  projectId: P,
  stageKey: 'F1_STRUCTURE',
  stageName: 'First floor structure',
  key: 'F1_STRUCTURE.WALLS',
  name: 'First floor — columns & brickwork',
  sortOrder: 6,
  plannedStart: '2026-10-08',
  plannedEnd: '2026-10-20',
  durationDays: 10,
  curingDays: 7,
  curingUntil: null,
  status: 'IN_PROGRESS',
  progressPercent: 40,
  actualStart: '2026-10-08',
  actualEnd: null,
  dependsOn: [],
  quotas: [{ materialId: 'cement', material: 'cement', description: 'Cement OPC', unit: 'bag', ownerSupplied: false, plannedQty: 65.29, usedQty: 53, remainingQty: 12.29 }],
  updatedAt: '2026-10-16T07:42:40.907Z',
  ...over,
});

const transfer = (over: Partial<EquipmentTransferRow> = {}): EquipmentTransferRow => ({
  id: 'tr-1',
  number: 'ET-0003',
  kind: 'DISPATCH',
  status: 'ON_THE_WAY',
  fromLocationId: YARD,
  toLocationId: LOC,
  projectId: P,
  from: 'Central Store',
  sentAt: '2026-10-16T03:00:00.000Z',
  blindCount: false,
  items: [
    { id: 'it-plates', equipmentId: 'eq-plates', rentalId: null, sentQty: 100, receivedQty: null, damagedQty: null, note: null },
    { id: 'it-props', equipmentId: 'eq-props', rentalId: 'rent-1', sentQty: 40, receivedQty: null, damagedQty: null, note: null },
  ],
  ...over,
});

function seed() {
  const db = testDb();
  putRow(db, 'projects', { id: P, name: 'DHA House', code: 'P-1', status: 'ACTIVE' });
  putRow(db, 'stock_locations', { id: LOC, type: 'SITE', name: 'DHA site', projectId: P });
  putRow(db, 'materials', { id: 'cement', name: 'Cement', unit: 'bag', groupId: 'g', supplyCategory: 'CONTRACTOR', isHidden: false });
  putRow(db, 'site_stock', { id: `${LOC}:cement`, locationId: LOC, materialId: 'cement', quantity: 40, ownerQuantity: 0 });
  putRow(db, 'equipment', { id: 'eq-plates', code: 'SP-01', name: 'Shuttering plate 2x3', kind: 'BULK', category: 'SHUTTERING_PLATE', unit: 'nos', isActive: true });
  putRow(db, 'equipment', { id: 'eq-props', code: 'PR-01', name: 'Steel prop', kind: 'BULK', category: 'PROP', unit: 'nos', isActive: true });
  putRow(db, 'equipment_stock', { id: `${LOC}:eq-plates:own`, locationId: LOC, equipmentId: 'eq-plates', rentalId: null, quantity: 130 });
  putRow(db, 'equipment_rentals', { id: 'rent-1', number: 'RNT-0001', status: 'ACTIVE', supplierName: 'Punjab Shuttering Yard', projectId: P, locationId: LOC, startDate: '2026-10-01', expectedEndDate: '2026-10-26', items: [] });
  return db;
}

const noMoney = (payload: unknown) => expect(JSON.stringify(payload)).not.toMatch(/paisa|rate|amount|value|price|cost/i);
const payloads = (db: ReturnType<typeof testDb>) => pendingItems(db).map((i) => ({ type: i.type, payload: JSON.parse(i.payload) as Record<string, unknown> }));

beforeEach(() => resetEngineForTests());

describe('pull: the new tables are stored on the phone', () => {
  it('saves milestones, stoppages, site instructions, equipment, snags and drawings; a snapshot replaces them', async () => {
    const db = testDb();
    const api = new FakeApi().page({
      milestones: { upserts: [milestone()], deletes: [] },
      stoppages: { upserts: [{ id: 'st-1', projectId: P, dates: ['2026-10-14'], reason: 'SMOG_BAN', category: 'EXCUSABLE', status: 'PENDING', note: null, photoAttachmentIds: ['a1'], clientId: null, reportedById: 'u1', reportedAt: '2026-10-16T07:00:00Z', decidedAt: null, decisionNote: null }], deletes: [] },
      site_instructions: { upserts: [{ id: 'si-1', projectId: P, number: 1, code: 'SI-001', note: 'Skylight', photoIds: [], status: 'CONVERTED', changeOrderId: 'co', changeOrderCode: 'CO-003', dismissReason: null, clientId: null, createdById: 'u1', createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-16T08:00:00Z' }], deletes: [] },
      equipment: { upserts: [{ id: 'eq-1', code: 'MX-01', name: 'Mixer', kind: 'MACHINE', category: 'MIXER', unit: 'nos', isActive: true }], deletes: [] },
      equipment_stock: { upserts: [{ id: `${LOC}:eq-1:own`, locationId: LOC, equipmentId: 'eq-1', rentalId: null, quantity: 1 }], deletes: [] },
      equipment_transfers: { upserts: [transfer()], deletes: [] },
      equipment_rentals: { upserts: [{ id: 'rent-1', number: 'RNT-0001', status: 'ACTIVE', supplierName: 'Yard', projectId: P, locationId: LOC, startDate: '2026-10-01', expectedEndDate: null, items: [] }], deletes: [] },
      equipment_losses: { upserts: [{ id: 'el-1', number: 'EL-0001', kind: 'MISSING', status: 'REPORTED', source: 'REPORT', equipmentId: 'eq-1', rentalId: null, locationId: LOC, projectId: P, transferId: null, qty: 6, note: 'gone', reportedAt: '2026-10-11T12:00:00Z' }], deletes: [] },
      snags: { upserts: [{ id: 'sn-1', projectId: P, number: 1, code: 'SN-001', status: 'OPEN', description: 'Honeycombing', location: 'Lounge', beforePhotoIds: ['p'], afterPhotoIds: [], updatedAt: '2026-10-16T06:00:00Z' }], deletes: [] },
      drawings: { upserts: [{ id: 'dw-1', projectId: P, folder: 'ARCHITECTURAL', title: 'Ground floor plan', number: 'A-101', latestRevisionId: 'r2', latestRevisionNo: 2, latestAttachmentId: 'att-2', latestApprovedAt: '2026-06-18', revisionCount: 2, updatedAt: '2026-10-16T06:00:00Z' }], deletes: [] },
    });
    await pullAll(db, api);
    for (const table of ['milestones', 'stoppages', 'site_instructions', 'equipment', 'equipment_stock', 'equipment_transfers', 'equipment_rentals', 'equipment_losses', 'snags', 'drawings'] as const) {
      expect([table, listRows(db, table).length]).toEqual([table, 1]);
    }
    expect(listRows(db, 'milestones', P)[0]).toMatchObject({ key: 'F1_STRUCTURE.WALLS', quotas: [expect.objectContaining({ remainingQty: 12.29 })] });
    expect(listRows(db, 'equipment_transfers', P)).toHaveLength(1); // filtered by project like the other tables

    // A later snapshot (reset) replaces the server rows.
    const again = new FakeApi().page({ snags: { upserts: [], deletes: [] }, drawings: { upserts: [], deletes: [] } });

    setSyncState(db, { cursor: null });
    await pullAll(db, again);
    expect(listRows(db, 'snags')).toEqual([]);
    expect(listRows(db, 'drawings')).toEqual([]);
  });

  it('a pulled row with the same clientId replaces the copy made on the phone', async () => {
    const db = seed();
    const clientId = recordInstruction(db, ctx, { projectId: P, note: 'Owner wants a window', photoIds: [] });
    const api = new FakeApi().page({ site_instructions: { upserts: [{ id: 'si-srv', projectId: P, number: 4, code: 'SI-004', note: 'Owner wants a window', photoIds: [], status: 'NEW', changeOrderId: null, changeOrderCode: null, dismissReason: null, clientId, createdById: ctx.userId, createdAt: '2026-10-16T04:00:00Z', updatedAt: '2026-10-16T04:00:00Z' }], deletes: [] } });
    api.decide = () => ({ status: 'APPLIED', serverId: 'si-srv' });
    await syncNow(db, api, { now: () => ctx.now.getTime() });
    expect(siteInstructions(db, P, ctx.userId, false)).toEqual([expect.objectContaining({ id: 'si-srv', code: 'SI-004' })]);
  });
});

describe('Step 13 · milestones', () => {
  it('today: the window covers the day, or work is going on / curing / blocked; DONE is left out', () => {
    const db = seed();
    putRow(db, 'milestones', milestone());
    putRow(db, 'milestones', milestone({ id: 'ms-slab', key: 'F1_STRUCTURE.SLAB', sortOrder: 7, status: 'PLANNED', progressPercent: 0, plannedStart: '2026-11-01', plannedEnd: '2026-11-10' }));
    putRow(db, 'milestones', milestone({ id: 'ms-done', key: 'GF_STRUCTURE.SLAB', sortOrder: 5, status: 'DONE', progressPercent: 100 }));
    putRow(db, 'milestones', milestone({ id: 'ms-late', key: 'FOUNDATION_PLINTH.PLINTH_FILL', sortOrder: 3, status: 'PLANNED', progressPercent: 0, plannedStart: '2026-10-01', plannedEnd: '2026-10-10' }));
    expect(todayMilestones(db, P, TODAY).map((m) => m.id)).toEqual(['ms-walls']);
    expect(openMilestones(db, P).map((m) => m.id)).toEqual(['ms-late', 'ms-walls', 'ms-slab']);
    expect(isLate(milestone({ id: 'x', status: 'PLANNED', plannedEnd: '2026-10-10' }), TODAY)).toBe(true);
    expect(isLate(milestone({ status: 'CURING', plannedEnd: '2026-10-10' }), TODAY)).toBe(false);
    expect(milestoneLabel('roman', milestone())).toBe('Pehli manzil ka dhancha — Column aur chunai');
    expect(milestoneLabel('roman', milestone({ key: 'CUSTOM.THING' }))).toBe('First floor — columns & brickwork');
  });

  it('status rules: allowed changes only, BLOCKED needs a note, progress drives the status like the server', () => {
    const m = milestone();
    expect(statusChoices(m)).toEqual(['BLOCKED', 'CURING', 'DONE']);
    expect(statusChoices(milestone({ curingDays: 0 }))).toEqual(['BLOCKED', 'DONE']);
    expect(statusChoices(milestone({ status: 'DONE' }))).toEqual([]);
    expect(checkProgress(m, { status: 'BLOCKED' }).error).toBe('NOTE_REQUIRED');
    expect(checkProgress(m, { status: 'BLOCKED', note: 'No shuttering' })).toEqual({ status: 'BLOCKED', progressPercent: 40, error: null });
    expect(checkProgress(m, { status: 'PLANNED' }).error).toBe('INVALID_STATUS_CHANGE');
    expect(checkProgress(milestone({ status: 'DONE', progressPercent: 100 }), { progressPercent: 50 }).error).toBe('NOTHING_CHANGED'); // done stays done (reopening is an office job)
    expect(checkProgress(m, { progressPercent: 100 })).toEqual({ status: 'CURING', progressPercent: 100, error: null });
    expect(checkProgress(milestone({ curingDays: 0 }), { progressPercent: 100 }).status).toBe('DONE');
    expect(checkProgress(milestone({ status: 'PLANNED', progressPercent: 0 }), { progressPercent: 10 }).status).toBe('IN_PROGRESS');
    expect(checkProgress(m, {}).error).toBe('NOTHING_CHANGED');
    expect(checkProgress(m, { progressPercent: 101 }).error).toBe('VALIDATION_ERROR');
  });

  it('MILESTONE_PROGRESS: payload = POST /milestones/:id/progress body + milestoneId; the milestone changes on the phone at once', () => {
    const db = seed();
    const m = milestone();
    putRow(db, 'milestones', m);
    updateMilestone(db, ctx, m, { progressPercent: 100, note: 'Walls done', photoIds: ['ph-1'] });
    expect(payloads(db)).toEqual([{ type: 'MILESTONE_PROGRESS', payload: { milestoneId: 'ms-walls', progressPercent: 100, note: 'Walls done', date: TODAY, photoAttachmentIds: ['ph-1'] } }]);
    expect(getRow(db, 'milestones', 'ms-walls')).toMatchObject({ status: 'CURING', progressPercent: 100, actualEnd: TODAY, curingUntil: '2026-10-23', pendingSync: true });
    expect(() => updateMilestone(db, ctx, m, { status: 'BLOCKED' })).toThrow('NOTE_REQUIRED');
  });

  it('usage for a milestone sends milestoneId and the quota left drops at once', () => {
    const db = seed();
    putRow(db, 'milestones', milestone());
    recordUsage(db, ctx, { projectId: P, date: TODAY, items: [{ materialId: 'cement', qty: 5 }], milestoneId: 'ms-walls' });
    expect(payloads(db)[0]!.payload).toMatchObject({ projectId: P, milestoneId: 'ms-walls', items: [{ materialId: 'cement', qty: '5' }] });
    expect(getRow<MilestoneRow>(db, 'milestones', 'ms-walls')!.quotas[0]).toMatchObject({ usedQty: 58, remainingQty: 7.29 });
    recordUsage(db, ctx, { projectId: P, date: TODAY, items: [{ materialId: 'cement', qty: 1 }] });
    expect(payloads(db)[1]!.payload).not.toHaveProperty('milestoneId');
  });
});

describe('Step 13 · stoppage days', () => {
  const base = { reason: 'RAIN' as const, from: TODAY, days: 1, note: '', photoIds: ['ph'] };
  const taken: StoppageRow = { id: 's', projectId: P, dates: ['2026-10-18'], reason: 'RAIN', category: 'EXCUSABLE', status: 'PENDING', note: null, photoAttachmentIds: [], clientId: null, reportedById: null, reportedAt: '', decidedAt: null, decisionNote: null };

  it('photo required except HOLIDAY; note required for OTHER; 1–31 days, ≤ 60 days ahead, no day twice', () => {
    expect(checkStoppage(base, [], TODAY)).toBeNull();
    expect(checkStoppage({ ...base, photoIds: [] }, [], TODAY)).toBe('PHOTO_REQUIRED');
    expect(checkStoppage({ ...base, reason: 'HOLIDAY', photoIds: [] }, [], TODAY)).toBeNull();
    expect(checkStoppage({ ...base, reason: 'OTHER' }, [], TODAY)).toBe('NOTE_REQUIRED');
    expect(checkStoppage({ ...base, reason: 'OTHER', note: 'Gas line work' }, [], TODAY)).toBeNull();
    expect(checkStoppage({ ...base, days: 32 }, [], TODAY)).toBe('VALIDATION_ERROR');
    expect(checkStoppage({ ...base, from: '2026-12-15', days: 2 }, [], TODAY)).toBe('DATE_TOO_FAR');
    expect(checkStoppage({ ...base, days: 3 }, [taken], TODAY)).toBe('STOPPAGE_OVERLAP');
    expect(checkStoppage({ ...base, days: 3 }, [{ ...taken, status: 'REJECTED' }], TODAY)).toBeNull();
  });

  it('STOPPAGE_LOG: payload = POST /projects/:id/stoppages body + projectId; PENDING row on the phone', () => {
    const db = seed();
    const id = logStoppage(db, ctx, { projectId: P, reason: 'SMOG_BAN', from: TODAY, days: 2, note: 'District ban', photoIds: ['ph-1'] });
    expect(payloads(db)).toEqual([{ type: 'STOPPAGE_LOG', payload: { projectId: P, dates: ['2026-10-16', '2026-10-17'], reason: 'SMOG_BAN', note: 'District ban', photoAttachmentIds: ['ph-1'] } }]);
    expect(getRow(db, 'stoppages', id)).toMatchObject({ status: 'PENDING', category: 'EXCUSABLE', clientId: id });
    expect(() => logStoppage(db, ctx, { projectId: P, reason: 'RAIN', from: '2026-10-17', days: 1, photoIds: ['x'] })).toThrow('STOPPAGE_OVERLAP');
    expect(() => logStoppage(db, ctx, { projectId: P, reason: 'LABOUR_SHORT', from: '2026-10-20', days: 1, photoIds: [] })).toThrow('PHOTO_REQUIRED');
  });

  it('photos are uploaded first (own clientId); with "Wi-Fi only" on mobile data the stoppage waits, an instruction without a photo goes', async () => {
    const db = seed();
    const photo = queueAttachment(db, { localUri: 'file:///rain.jpg', kind: 'SITE_PHOTO', mimeType: 'image/jpeg' }, ctx.now.getTime());
    const stop = logStoppage(db, ctx, { projectId: P, reason: 'RAIN', from: TODAY, days: 1, photoIds: [photo] });
    recordInstruction(db, { ...ctx, now: new Date(ctx.now.getTime() + 1000) }, { projectId: P, note: 'Owner wants tiles changed', photoIds: [] });

    const api = new FakeApi();
    await syncNow(db, api, { now: () => ctx.now.getTime(), canUpload: async () => false });
    expect(api.uploads).toEqual([]);
    expect(api.pushed.flat().map((m) => m.type)).toEqual([]); // the prefix stops at the entry waiting for its photo
    expect(pendingItems(db).map((i) => i.clientId)).toContain(stop);

    resetEngineForTests();
    const wifi = new FakeApi();
    await syncNow(db, wifi, { now: () => ctx.now.getTime() });
    expect(wifi.uploads.map((u) => u.clientId)).toEqual([photo]);
    expect(wifi.pushed[0]!.map((m) => m.type)).toEqual(['STOPPAGE_LOG', 'SITE_INSTRUCTION_CREATE']);
    expect(wifi.pushed[0]![0]!.payload['photoAttachmentIds']).toEqual([photo]); // the server resolves the attachment clientId
  });
});

describe('Step 15 · site instructions', () => {
  it('note of 3+ letters; SITE_INSTRUCTION_CREATE = POST body + projectId; own list only without .view', () => {
    const db = seed();
    expect(checkInstruction('ok')).toBe('NOTE_REQUIRED');
    expect(() => recordInstruction(db, ctx, { projectId: P, note: ' a ', photoIds: [] })).toThrow('NOTE_REQUIRED');
    recordInstruction(db, ctx, { projectId: P, note: ' Skylight above the stairs ', photoIds: ['ph-1'] });
    expect(payloads(db)).toEqual([{ type: 'SITE_INSTRUCTION_CREATE', payload: { projectId: P, note: 'Skylight above the stairs', photoIds: ['ph-1'] } }]);
    putRow(db, 'site_instructions', { id: 'other', projectId: P, note: 'PM note', photoIds: [], status: 'NEW', createdById: 'u-pm', createdAt: '2026-10-15T00:00:00Z', updatedAt: '' });
    expect(siteInstructions(db, P, ctx.userId, false)).toHaveLength(1);
    expect(siteInstructions(db, P, ctx.userId, true)).toHaveLength(2);
  });
});

describe('Step 16 · equipment', () => {
  it('on site: owned and rented lines apart with counts; incoming = on the way to this site', () => {
    const db = seed();
    putRow(db, 'equipment_stock', { id: `${LOC}:eq-props:rent-1`, locationId: LOC, equipmentId: 'eq-props', rentalId: 'rent-1', quantity: 150 });
    putRow(db, 'equipment_stock', { id: `${YARD}:eq-props:own`, locationId: YARD, equipmentId: 'eq-props', rentalId: null, quantity: 999 });
    putRow(db, 'equipment_transfers', transfer());
    putRow(db, 'equipment_transfers', transfer({ id: 'tr-back', kind: 'RETURN', fromLocationId: LOC, toLocationId: YARD }));
    expect(siteEquipment(db, P).map((s) => [s.equipment?.name, s.quantity, s.rental?.supplierName ?? null])).toEqual([
      ['Shuttering plate 2x3', 130, null],
      ['Steel prop', 150, 'Punjab Shuttering Yard'],
    ]);
    expect(incomingEquipment(db, P).map((t) => t.id)).toEqual(['tr-1']);
  });

  it('receive rules: damaged ≤ counted, not more than sent, a note when short or damaged; blind hides the sent qty', () => {
    const item = transfer().items[0]!;
    expect(checkReceiveLine(item, { received: 100, damaged: 0 }, false)).toBeNull();
    expect(checkReceiveLine(item, { received: 90, damaged: 0 }, false)).toBe('NOTE_REQUIRED');
    expect(checkReceiveLine(item, { received: 90, damaged: 0, note: '10 left at the yard' }, false)).toBeNull();
    expect(checkReceiveLine(item, { received: 101, damaged: 0 }, false)).toBe('RECEIVED_EXCEEDS_SENT');
    expect(checkReceiveLine(item, { received: 5, damaged: 6, note: 'x' }, false)).toBe('DAMAGED_EXCEEDS_COUNTED');
    expect(checkReceiveLine(item, { received: 100, damaged: 2 }, false)).toBe('NOTE_REQUIRED');
    expect(checkReceiveLine(item, { received: Number.NaN, damaged: 0 }, false)).toBe('VALIDATION_ERROR');
    // Blind: the phone doesn't know the sent quantity.
    expect(checkReceiveLine({ ...item, sentQty: undefined }, { received: 90, damaged: 0 }, true)).toBeNull();
    expect(hidesSentQty(transfer({ blindCount: true }))).toBe(true);
    expect(hidesSentQty(transfer({ items: [{ ...item, sentQty: undefined }] }))).toBe(true);
    expect(hidesSentQty(transfer())).toBe(false);
  });

  it('EQUIPMENT_RECEIVE: receive body + transferId; the site balance goes up at once', () => {
    const db = seed();
    const t = transfer();
    putRow(db, 'equipment_transfers', t);
    receiveEquipment(db, ctx, t, [
      { itemId: 'it-plates', received: 98, damaged: 3, note: '2 short, 3 bent', photoId: 'ph-bent' },
      { itemId: 'it-props', received: 40, damaged: 0 },
    ]);
    const [p] = payloads(db);
    expect(p).toEqual({
      type: 'EQUIPMENT_RECEIVE',
      payload: { transferId: 'tr-1', date: TODAY, items: [{ itemId: 'it-plates', receivedQty: 98, damagedQty: 3, note: '2 short, 3 bent', photoAttachmentId: 'ph-bent' }, { itemId: 'it-props', receivedQty: 40 }] },
    });
    noMoney(p!.payload);
    expect(getRow(db, 'equipment_transfers', 'tr-1')).toMatchObject({ status: 'RECEIVED_WITH_GAP', pendingSync: true });
    expect(getRow(db, 'equipment_stock', `${LOC}:eq-plates:own`)).toMatchObject({ quantity: 228 });
    expect(getRow(db, 'equipment_stock', `${LOC}:eq-props:rent-1`)).toMatchObject({ quantity: 40, rentalId: 'rent-1' });
    expect(() => receiveEquipment(db, ctx, t, [{ itemId: 'it-plates', received: 100, damaged: 0 }])).toThrow('ITEMS_MISMATCH');
  });

  it('loss rules + EQUIPMENT_LOSS_REPORT: missing leaves the site balance, damaged needs a photo and stays', () => {
    const db = seed();
    expect(checkLoss({ kind: 'MISSING', qty: 0, note: 'gone' }, 10)).toBe('VALIDATION_ERROR');
    expect(checkLoss({ kind: 'MISSING', qty: 11, note: 'gone' }, 10)).toBe('INSUFFICIENT_EQUIPMENT');
    expect(checkLoss({ kind: 'MISSING', qty: 1, note: 'x' }, 10)).toBe('NOTE_REQUIRED');
    expect(checkLoss({ kind: 'DAMAGED', qty: 1, note: 'bent plate' }, 10)).toBe('PHOTO_REQUIRED');
    expect(checkLoss({ kind: 'DAMAGED', qty: 1, note: 'bent plate', photoId: 'p' }, 10)).toBeNull();

    const id = reportEquipmentLoss(db, ctx, { projectId: P, equipmentId: 'eq-plates', rentalId: null, kind: 'MISSING', qty: 6, note: 'Not found after de-shuttering' });
    expect(payloads(db)[0]).toEqual({ type: 'EQUIPMENT_LOSS_REPORT', payload: { projectId: P, equipmentId: 'eq-plates', kind: 'MISSING', qty: 6, note: 'Not found after de-shuttering', date: TODAY } });
    expect(getRow(db, 'equipment_stock', `${LOC}:eq-plates:own`)).toMatchObject({ quantity: 124 });
    expect(getRow(db, 'equipment_losses', id)).toMatchObject({ status: 'REPORTED', number: '—' });
    reportEquipmentLoss(db, ctx, { projectId: P, equipmentId: 'eq-plates', rentalId: null, kind: 'DAMAGED', qty: 2, note: 'Bent edges', photoId: 'ph-1' });
    expect(payloads(db)[1]!.payload).toMatchObject({ kind: 'DAMAGED', photoAttachmentId: 'ph-1' });
    expect(getRow(db, 'equipment_stock', `${LOC}:eq-plates:own`)).toMatchObject({ quantity: 124 });
    for (const p of payloads(db)) noMoney(p.payload);
  });
});

describe('Step 17 · snags and drawings', () => {
  it('snag rules: where, what (3+), a before photo; fixing needs an after photo and an OPEN snag', () => {
    expect(checkSnag({ location: ' ', description: 'Crack', beforePhotoIds: ['p'] })).toBe('LOCATION_REQUIRED');
    expect(checkSnag({ location: 'Lounge', description: 'ab', beforePhotoIds: ['p'] })).toBe('DESCRIPTION_REQUIRED');
    expect(checkSnag({ location: 'Lounge', description: 'Crack', beforePhotoIds: [] })).toBe('PHOTO_REQUIRED');
    expect(checkSnag({ location: 'Lounge', description: 'Crack', beforePhotoIds: ['p'] })).toBeNull();
    expect(checkFix({ status: 'OPEN' }, [])).toBe('PHOTO_REQUIRED');
    expect(checkFix({ status: 'FIXED' }, ['p'])).toBe('INVALID_SNAG_STATUS');
  });

  it('SNAG_CREATE then SNAG_FIX on the same (still unsent) snag: the fix waits for it', () => {
    const db = seed();
    putRow(db, 'workers', { id: 'w-1', name: 'Bashir', type: 'MISTRI', isActive: true });
    putRow(db, 'project_workers', { id: 'pw-1', projectId: P, workerId: 'w-1', isActive: true });
    const who = assigneeOptions(db, P)[0]!;
    const id = createSnag(db, ctx, { projectId: P, location: 'Master bedroom', description: 'Plaster crack near window', beforePhotoIds: ['b1'], targetDate: '2026-10-23', assignee: who });
    const s = getRow<SnagRow>(db, 'snags', id)!;
    expect(s).toMatchObject({ status: 'OPEN', workerId: 'w-1', assigneeType: 'WORKER', clientId: id });
    fixSnag(db, ctx, s, { afterPhotoIds: ['a1'], note: 'Filled and painted' });
    const items = pendingItems(db);
    expect(items.map((i) => JSON.parse(i.payload))).toEqual([
      { projectId: P, location: 'Master bedroom', description: 'Plaster crack near window', beforePhotoIds: ['b1'], targetDate: '2026-10-23', workerId: 'w-1' },
      { snagId: id, afterPhotoIds: ['a1'], note: 'Filled and painted' },
    ]);
    expect(JSON.parse(items[1]!.dependsOn)).toEqual([id]);
    expect(getRow(db, 'snags', id)).toMatchObject({ status: 'FIXED', afterPhotoIds: ['a1'] });
    for (const i of items) noMoney(JSON.parse(i.payload));
  });

  it('snag list: status filter, open first; overdue', () => {
    const db = seed();
    putRow(db, 'snags', { id: 'a', projectId: P, number: 1, code: 'SN-001', status: 'VERIFIED', description: 'x', updatedAt: '1' });
    putRow(db, 'snags', { id: 'b', projectId: P, number: 2, code: 'SN-002', status: 'OPEN', description: 'y', updatedAt: '2' });
    putRow(db, 'snags', { id: 'c', projectId: P, number: 3, code: 'SN-003', status: 'FIXED', description: 'z', updatedAt: '3' });
    expect(snags(db, P).map((s) => s.code)).toEqual(['SN-002', 'SN-003', 'SN-001']);
    expect(snags(db, P, 'FIXED').map((s) => s.code)).toEqual(['SN-003']);
    expect(isOverdue({ status: 'OPEN', targetDate: '2026-10-15' }, TODAY)).toBe(true);
    expect(isOverdue({ status: 'FIXED', targetDate: '2026-10-15' }, TODAY)).toBe(false);
  });

  it('drawings: latest revisions grouped by folder; file types', () => {
    const db = seed();
    putRow(db, 'drawings', { id: 'd1', projectId: P, folder: 'STRUCTURAL', title: 'Slab', number: 'S-201', latestAttachmentId: 'a1', revisionCount: 1 });
    putRow(db, 'drawings', { id: 'd2', projectId: P, folder: 'ARCHITECTURAL', title: 'GF plan', number: 'A-101', latestAttachmentId: 'a2', revisionCount: 2 });
    putRow(db, 'drawings', { id: 'd3', projectId: P, folder: 'ARCHITECTURAL', title: 'Elevation', number: 'A-001', latestAttachmentId: 'a3', revisionCount: 1 });
    expect(drawingsByFolder(db, P).map((g) => [g.folder, g.items.map((d) => d.number)])).toEqual([
      ['ARCHITECTURAL', ['A-001', 'A-101']],
      ['STRUCTURAL', ['S-201']],
    ]);
    expect(extensionOf('application/pdf', 'x.pdf')).toBe('pdf');
    expect(extensionOf('application/octet-stream', 'Plan R2.DWG')).toBe('dwg');
    expect(isImage('image/webp')).toBe(true);
    expect(isImage('application/pdf')).toBe(false);
  });
});

describe('outbox entries are labelled', () => {
  it('every new mutation has a sync-problems label', () => {
    const db = seed();
    recordInstruction(db, ctx, { projectId: P, note: 'Owner wants a skylight', photoIds: [] });
    expect(db.select().from(outbox).all()[0]!.label).toBe('Owner wants a skylight');
  });
});
