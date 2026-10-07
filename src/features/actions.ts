/**
 * Every write the munshi makes: the mutation for the server + the optimistic rows the screens
 * show at once (marked `pendingSync`). Plain functions of the database — the screens call them
 * through `useSave`, the tests call them directly.
 *
 * Ids: a record made on the phone gets id = clientId (UUID v7). A later mutation that refers to
 * it sends that clientId and lists it in `dependsOn`; the server swaps in the real id.
 */
import { inArray } from 'drizzle-orm';
import { outbox } from '../db/schema';
import { getRow, listRows } from '../db/store';
import type { Db } from '../db/types';
import { todayPK, weekOf, type WeekDay } from '../lib/dates';
import { toPaisa } from '../lib/money';
import { uuidv7 } from '../lib/uuid';
import { enqueue, type Write } from '../sync/outbox';
import { cashAccount, myLogOn, settings, siteLocation, stockOf } from './queries';
import type {
  AttendanceRow,
  AttendanceStatus,
  CashAccountRow,
  CashEntryRow,
  DailyLogRow,
  DispatchRow,
  ExpenseCategory,
  PurchaseRow,
  SettlementRow,
  SiteCondition,
  SiteStockRow,
  WorkerType,
} from './types';

export interface Ctx {
  userId: string;
  userName: string;
  now?: Date;
}

const nowOf = (c: Ctx) => c.now ?? new Date();

/** The ids among `ids` that are still unsent records made on this phone. */
export function pendingDeps(db: Db, ids: (string | null | undefined)[]): string[] {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return [];
  return db
    .select({ id: outbox.clientId, status: outbox.status })
    .from(outbox)
    .where(inArray(outbox.clientId, wanted))
    .all()
    .filter((r) => r.status === 'PENDING' || r.status === 'SENDING')
    .map((r) => r.id);
}

const qtyStr = (n: number) => String(Math.round(n * 1000) / 1000);

// ─── Hazri ──────────────────────────────────────────────────────────────────

export interface HazriEntry {
  workerId: string;
  status: AttendanceStatus;
  overtimeHours?: number;
}

export function markAttendance(db: Db, c: Ctx, input: { projectId: string; date: string; entries: HazriEntry[] }) {
  const existing = listRows<AttendanceRow>(db, 'attendance', input.projectId).filter((a) => a.date === input.date);
  const writes: Write[] = input.entries.map((e) => {
    const prev = existing.find((a) => a.workerId === e.workerId);
    return {
      table: 'attendance',
      row: {
        id: prev?.id ?? `local:${input.projectId}:${e.workerId}:${input.date}`,
        projectId: input.projectId,
        workerId: e.workerId,
        date: input.date,
        status: e.status,
        overtimeHours: e.overtimeHours ?? 0,
        note: null,
        clientId: prev?.clientId ?? null,
        pendingSync: true,
      },
    };
  });
  return enqueue(
    db,
    {
      type: 'ATTENDANCE_UPSERT',
      payload: { projectId: input.projectId, date: input.date, entries: input.entries.map((e) => ({ workerId: e.workerId, status: e.status, ...(e.overtimeHours ? { overtimeHours: e.overtimeHours } : {}) })) },
      label: `Hazri ${input.date} (${input.entries.length})`,
      dependsOn: pendingDeps(db, input.entries.map((e) => e.workerId)),
      writes,
    },
    nowOf(c),
  );
}

/** New worker + put him on this site (two mutations, the second depends on the first). */
export function addWorker(db: Db, c: Ctx, input: { projectId: string; name: string; type: WorkerType; phone?: string; dailyRatePaisa?: string }) {
  const now = nowOf(c);
  const workerId = uuidv7(now.getTime());
  enqueue(
    db,
    {
      clientId: workerId,
      type: 'WORKER_CREATE',
      payload: { name: input.name, type: input.type, ...(input.phone ? { phone: input.phone } : {}), ...(input.dailyRatePaisa ? { dailyRatePaisa: input.dailyRatePaisa } : {}) },
      label: `Worker ${input.name}`,
      writes: [{ table: 'workers', row: { id: workerId, name: input.name, type: input.type, phone: input.phone ?? null, dailyRatePaisa: input.dailyRatePaisa ?? null, isActive: true, pendingSync: true } }],
    },
    now,
  );
  const pwId = uuidv7(now.getTime() + 1);
  enqueue(
    db,
    {
      clientId: pwId,
      type: 'PROJECT_WORKER_ASSIGN',
      payload: { projectId: input.projectId, workerId, ...(input.dailyRatePaisa ? { dailyRatePaisa: input.dailyRatePaisa } : {}) },
      label: `${input.name} → site`,
      dependsOn: [workerId],
      writes: [{ table: 'project_workers', row: { id: pwId, projectId: input.projectId, workerId, dailyRatePaisa: input.dailyRatePaisa ?? null, startDate: todayPK(now), endDate: null, isActive: true, pendingSync: true } }],
    },
    now,
  );
  return workerId;
}

/** Peshgi from the munshi's own site cash (the cash balance drops at once). */
export function giveAdvance(db: Db, c: Ctx, input: { projectId: string; payeeType: 'WORKER' | 'SUBCONTRACTOR'; workerId?: string; assignmentId?: string; amountPaisa: string; date: string; note?: string; label: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const writes: Write[] = [
    {
      table: 'advances',
      row: { id: clientId, clientId, projectId: input.projectId, payeeType: input.payeeType, workerId: input.workerId ?? null, assignmentId: input.assignmentId ?? null, amountPaisa: input.amountPaisa, date: input.date, paidFrom: 'SITE_CASH', note: input.note ?? null, pendingSync: true },
    },
  ];
  const acc = cashAccount(db);
  if (acc) writes.push({ table: 'cash_accounts', row: { ...acc, balancePaisa: (toPaisa(acc.balancePaisa) - toPaisa(input.amountPaisa)).toString() } });
  return enqueue(
    db,
    {
      clientId,
      type: 'ADVANCE_CREATE',
      payload: {
        projectId: input.projectId,
        payeeType: input.payeeType,
        ...(input.workerId ? { workerId: input.workerId } : {}),
        ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
        amountPaisa: input.amountPaisa,
        date: input.date,
        paidFrom: 'SITE_CASH',
        ...(input.note ? { note: input.note } : {}),
      },
      label: input.label,
      dependsOn: pendingDeps(db, [input.workerId]),
      writes,
    },
    now,
  );
}

export function recordMeasurement(db: Db, c: Ctx, input: { projectId: string; assignmentId: string; date: string; description: string; quantity: number; unit: string; attachmentIds: string[] }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  return enqueue(
    db,
    {
      clientId,
      type: 'WORK_MEASUREMENT_CREATE',
      payload: { projectId: input.projectId, assignmentId: input.assignmentId, date: input.date, description: input.description, quantity: qtyStr(input.quantity), ...(input.attachmentIds.length ? { attachmentIds: input.attachmentIds } : {}) },
      label: `Naap: ${input.description}`,
      writes: [{ table: 'work_measurements', row: { id: clientId, clientId, projectId: input.projectId, assignmentId: input.assignmentId, date: input.date, description: input.description, quantity: input.quantity, unit: input.unit, status: 'RECORDED', note: null, attachmentIds: input.attachmentIds, pendingSync: true } }],
    },
    now,
  );
}

export function generateSettlement(db: Db, c: Ctx, input: { projectId: string; day: string }) {
  const now = nowOf(c);
  const w = weekOf(input.day, settings(db).settlementWeekStart as WeekDay);
  const clientId = uuidv7(now.getTime());
  const row: SettlementRow = { id: clientId, projectId: input.projectId, weekStart: w.weekStart, weekEnd: w.weekEnd, status: 'DRAFT', grossPaisa: null, advancePaisa: null, netPaisa: null, paidPaisa: null, returnComment: null, lines: [], pendingSync: true };
  return enqueue(db, { clientId, type: 'SETTLEMENT_GENERATE', payload: { projectId: input.projectId, weekStart: w.weekStart }, label: `Wages ${w.weekStart}`, writes: [{ table: 'settlements', row }] }, now);
}

export function submitSettlement(db: Db, c: Ctx, s: SettlementRow) {
  return enqueue(
    db,
    { type: 'SETTLEMENT_SUBMIT', payload: { settlementId: s.id }, label: `Wages ${s.weekStart} → approval`, dependsOn: pendingDeps(db, [s.id]), writes: [{ table: 'settlements', row: { ...s, status: 'SUBMITTED', pendingSync: true } }] },
    nowOf(c),
  );
}

export function paySettlement(db: Db, c: Ctx, s: SettlementRow, lineIds: string[]) {
  const lines = s.lines.map((l) => (lineIds.includes(l.id) ? { ...l, paymentStatus: 'PAID', paidFrom: 'SITE_CASH' } : l));
  const paid = s.lines.filter((l) => lineIds.includes(l.id)).reduce((sum, l) => sum + toPaisa(l.netPaisa), 0n);
  const writes: Write[] = [{ table: 'settlements', row: { ...s, lines, paidPaisa: (toPaisa(s.paidPaisa) + paid).toString(), pendingSync: true } }];
  const acc = cashAccount(db);
  if (acc) writes.push({ table: 'cash_accounts', row: { ...acc, balancePaisa: (toPaisa(acc.balancePaisa) - paid).toString() } });
  return enqueue(db, { type: 'SETTLEMENT_PAY', payload: { settlementId: s.id, lineIds, paidFrom: 'SITE_CASH' }, label: `Wages paid (${lineIds.length})`, writes }, nowOf(c));
}

// ─── Maal ───────────────────────────────────────────────────────────────────

export interface CountLine {
  materialId: string;
  received: number;
  damaged: number;
  note?: string;
}

function bumpStock(db: Db, locationId: string, deltas: { materialId: string; qty: number; owner?: boolean }[]): Write[] {
  return deltas.map((d) => {
    const s = stockOf(db, locationId, d.materialId) ?? ({ id: `${locationId}:${d.materialId}`, locationId, materialId: d.materialId, quantity: 0, ownerQuantity: 0 } as SiteStockRow);
    return { table: 'site_stock', row: { ...s, quantity: s.quantity + d.qty, ownerQuantity: s.ownerQuantity + (d.owner ? d.qty : 0) } };
  });
}

/** Counted on arrival. With blind count the munshi never sent the expected quantity; the result comes after sync. */
export function receiveDispatch(db: Db, c: Ctx, d: DispatchRow, lines: CountLine[], note?: string) {
  const items = d.items.map((i) => {
    const l = lines.find((x) => x.materialId === i.materialId);
    return l ? { ...i, receivedQty: l.received, damagedQty: l.damaged, note: l.note ?? null } : i;
  });
  return enqueue(
    db,
    {
      type: 'DISPATCH_RECEIVE',
      payload: { dispatchId: d.id, items: lines.map((l) => ({ materialId: l.materialId, receivedQty: qtyStr(l.received), ...(l.damaged ? { damagedQty: qtyStr(l.damaged) } : {}), ...(l.note ? { note: l.note } : {}) })), ...(note ? { note } : {}) },
      label: `Receive ${d.number}`,
      writes: [{ table: 'dispatches', row: { ...d, items, status: 'RECEIVED', receivedAt: nowOf(c).toISOString(), pendingSync: true } }, ...bumpStock(db, d.toLocationId, lines.map((l) => ({ materialId: l.materialId, qty: l.received - l.damaged })))],
    },
    nowOf(c),
  );
}

export function receivePurchase(db: Db, c: Ctx, p: PurchaseRow, lines: CountLine[], note?: string) {
  const items = p.items.map((i) => {
    const l = lines.find((x) => x.materialId === i.materialId);
    return l ? { ...i, countedQty: l.received, damagedQty: l.damaged, note: l.note ?? null } : i;
  });
  return enqueue(
    db,
    {
      type: 'PURCHASE_RECEIVE',
      payload: { purchaseId: p.id, items: lines.map((l) => ({ materialId: l.materialId, countedQty: qtyStr(l.received), ...(l.damaged ? { damagedQty: qtyStr(l.damaged) } : {}), ...(l.note ? { note: l.note } : {}) })), ...(note ? { note } : {}) },
      label: `Receive ${p.challanNo}`,
      writes: [{ table: 'purchases', row: { ...p, items, status: 'RECEIVED', receivedAt: nowOf(c).toISOString(), pendingSync: true } }, ...bumpStock(db, p.locationId, lines.map((l) => ({ materialId: l.materialId, qty: l.received - l.damaged })))],
    },
    nowOf(c),
  );
}

export interface QtyLine {
  materialId: string;
  qty: number;
}

export function ownerDelivery(db: Db, c: Ctx, input: { projectId: string; date: string; items: QtyLine[]; note?: string; photoIds: string[] }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const loc = siteLocation(db, input.projectId);
  const writes: Write[] = [
    {
      table: 'owner_deliveries',
      row: { id: clientId, projectId: input.projectId, locationId: loc?.id ?? '', deliveryDate: input.date, note: input.note ?? null, photoAttachmentIds: input.photoIds, items: input.items.map((i, n) => ({ id: `${clientId}:${n}`, materialId: i.materialId, quantity: i.qty })), pendingSync: true },
    },
  ];
  if (loc) writes.push(...bumpStock(db, loc.id, input.items.map((i) => ({ materialId: i.materialId, qty: i.qty, owner: true }))));
  return enqueue(
    db,
    {
      clientId,
      type: 'OWNER_DELIVERY_CREATE',
      payload: { projectId: input.projectId, deliveryDate: input.date, items: input.items.map((i) => ({ materialId: i.materialId, qty: qtyStr(i.qty) })), ...(input.note ? { note: input.note } : {}), photoAttachmentIds: input.photoIds },
      label: `Owner delivery (${input.items.length})`,
      writes,
    },
    now,
  );
}

/** "Maal lag gaya" — the site stock drops at once. */
export function recordUsage(db: Db, c: Ctx, input: { projectId: string; date: string; items: QtyLine[]; note?: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const loc = siteLocation(db, input.projectId);
  const writes: Write[] = [
    { table: 'material_usage', row: { id: clientId, projectId: input.projectId, locationId: loc?.id ?? '', usageDate: input.date, note: input.note ?? null, createdById: c.userId, items: input.items.map((i, n) => ({ id: `${clientId}:${n}`, materialId: i.materialId, quantity: i.qty })), pendingSync: true } },
  ];
  if (loc) writes.push(...bumpStock(db, loc.id, input.items.map((i) => ({ materialId: i.materialId, qty: -i.qty }))));
  return enqueue(
    db,
    {
      clientId,
      type: 'MATERIAL_USAGE_CREATE',
      payload: { projectId: input.projectId, usageDate: input.date, items: input.items.map((i) => ({ materialId: i.materialId, qty: qtyStr(i.qty) })), ...(input.note ? { note: input.note } : {}), deviceCreatedAt: now.toISOString() },
      label: `Maal lag gaya (${input.items.length})`,
      writes,
    },
    now,
  );
}

export type CountReason = 'HARDENED_IN_RAIN' | 'BREAKAGE' | 'THEFT_SUSPECTED' | 'MEASUREMENT' | 'OTHER';

export function stockCount(db: Db, c: Ctx, input: { locationId: string; items: { materialId: string; counted: number; reason?: CountReason }[]; note?: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const writes: Write[] = input.items.map((i) => {
    const s = stockOf(db, input.locationId, i.materialId) ?? ({ id: `${input.locationId}:${i.materialId}`, locationId: input.locationId, materialId: i.materialId, quantity: 0, ownerQuantity: 0 } as SiteStockRow);
    return { table: 'site_stock', row: { ...s, quantity: i.counted } };
  });
  return enqueue(
    db,
    {
      clientId,
      type: 'STOCK_COUNT_CREATE',
      payload: { locationId: input.locationId, countedAt: now.toISOString(), items: input.items.map((i) => ({ materialId: i.materialId, countedQty: qtyStr(i.counted), ...(i.reason ? { reason: i.reason } : {}) })), ...(input.note ? { note: input.note } : {}) },
      label: `Stock count (${input.items.length})`,
      writes,
    },
    now,
  );
}

/** A delivery bought by the munshi at the site (no rates — the office adds them). */
export function sitePurchase(db: Db, c: Ctx, input: { projectId: string; supplier: { id: string; name: string }; challanNo: string; vehicleNo?: string; date: string; challanPhotoId: string; items: QtyLine[]; note?: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const loc = siteLocation(db, input.projectId);
  const writes: Write[] = [
    {
      table: 'purchases',
      row: {
        id: clientId,
        number: '—',
        status: 'PENDING_RATE',
        projectId: input.projectId,
        locationId: loc?.id ?? '',
        supplier: input.supplier,
        challanNo: input.challanNo,
        vehicleNo: input.vehicleNo ?? null,
        purchaseDate: input.date,
        receivedAt: now.toISOString(),
        mine: true,
        blindCount: false,
        items: input.items.map((i, n) => ({ id: `${clientId}:${n}`, materialId: i.materialId, challanQty: i.qty, countedQty: i.qty, damagedQty: 0, note: null })),
        pendingSync: true,
      },
    },
  ];
  if (loc) writes.push(...bumpStock(db, loc.id, input.items.map((i) => ({ materialId: i.materialId, qty: i.qty }))));
  return enqueue(
    db,
    {
      clientId,
      type: 'SITE_PURCHASE_CREATE',
      payload: {
        supplierId: input.supplier.id,
        deliverTo: 'SITE',
        projectId: input.projectId,
        challanNo: input.challanNo,
        ...(input.vehicleNo ? { vehicleNo: input.vehicleNo } : {}),
        purchaseDate: input.date,
        challanAttachmentId: input.challanPhotoId,
        items: input.items.map((i) => ({ materialId: i.materialId, challanQty: qtyStr(i.qty), countedQty: qtyStr(i.qty) })),
        ...(input.note ? { note: input.note } : {}),
      },
      label: `Purchase ${input.challanNo}`,
      writes,
    },
    now,
  );
}

// ─── Kharcha ────────────────────────────────────────────────────────────────

export function addExpense(db: Db, c: Ctx, input: { projectId: string; category: ExpenseCategory; amountPaisa: string; description: string; attachmentId?: string; date: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const acc = cashAccount(db);
  const needsApproval = toPaisa(input.amountPaisa) > toPaisa(settings(db).kharchaApprovalLimitPaisa);
  const entry: CashEntryRow = {
    id: clientId,
    clientId,
    accountId: acc?.id ?? '',
    projectId: input.projectId,
    type: 'EXPENSE',
    amountPaisa: (-toPaisa(input.amountPaisa)).toString(),
    category: input.category,
    description: input.description,
    status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
    method: null,
    reviewNote: null,
    recoverableFromHolder: false,
    attachmentId: input.attachmentId ?? null,
    occurredAt: now.toISOString(),
    pendingSync: true,
  };
  const writes: Write[] = [{ table: 'cash_entries', row: entry }];
  if (acc) {
    const amt = toPaisa(input.amountPaisa);
    const next: CashAccountRow = { ...acc, balancePaisa: (toPaisa(acc.balancePaisa) - amt).toString(), pendingApprovalPaisa: (toPaisa(acc.pendingApprovalPaisa) + (needsApproval ? amt : 0n)).toString() };
    writes.push({ table: 'cash_accounts', row: next });
  }
  return enqueue(
    db,
    {
      clientId,
      type: 'CASH_EXPENSE_CREATE',
      payload: { projectId: input.projectId, category: input.category, amountPaisa: input.amountPaisa, description: input.description, ...(input.attachmentId ? { attachmentId: input.attachmentId } : {}), date: input.date },
      label: `Kharcha: ${input.description}`,
      writes,
    },
    now,
  );
}

export function acknowledgeFloat(db: Db, c: Ctx, entry: CashEntryRow) {
  const writes: Write[] = [{ table: 'cash_entries', row: { ...entry, status: 'POSTED', pendingSync: true } }];
  const acc = getRow<CashAccountRow>(db, 'cash_accounts', entry.accountId);
  if (acc) {
    const amt = toPaisa(entry.amountPaisa);
    writes.push({ table: 'cash_accounts', row: { ...acc, balancePaisa: (toPaisa(acc.balancePaisa) + amt).toString(), pendingAckPaisa: (toPaisa(acc.pendingAckPaisa) - amt).toString() } });
  }
  return enqueue(db, { type: 'FLOAT_ACKNOWLEDGE', payload: { entryId: entry.id }, label: 'Cash received', writes }, nowOf(c));
}

export function requestTopup(db: Db, c: Ctx, input: { amountPaisa: string; note?: string }) {
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const acc = cashAccount(db);
  return enqueue(
    db,
    {
      clientId,
      type: 'TOPUP_REQUEST_CREATE',
      payload: { amountPaisa: input.amountPaisa, ...(input.note ? { note: input.note } : {}) },
      label: 'Top-up request',
      writes: [{ table: 'topup_requests', row: { id: clientId, clientId, accountId: acc?.id ?? '', amountPaisa: input.amountPaisa, note: input.note ?? null, status: 'PENDING', decisionNote: null, createdAt: now.toISOString(), pendingSync: true } }],
    },
    now,
  );
}

// ─── Daily log ──────────────────────────────────────────────────────────────

export function saveDailyLog(db: Db, c: Ctx, input: { projectId: string; conditions: SiteCondition[]; workDone?: string; note?: string; photoIds: string[]; voiceIds: string[] }) {
  const now = nowOf(c);
  const day = todayPK(now);
  const mine = myLogOn(db, input.projectId, c.userId, day);
  const clientId = uuidv7(now.getTime());
  const row: DailyLogRow = {
    id: mine?.id ?? clientId,
    projectId: input.projectId,
    logDate: day,
    note: input.note ?? null,
    conditions: input.conditions,
    workDone: input.workDone ?? null,
    photoAttachmentIds: input.photoIds,
    voiceAttachmentIds: input.voiceIds,
    authorId: c.userId,
    authorName: c.userName,
    clientId: mine?.clientId ?? clientId,
    pendingSync: true,
  };
  return enqueue(
    db,
    {
      clientId,
      type: 'DAILY_LOG_UPSERT',
      payload: {
        projectId: input.projectId,
        logDate: day,
        conditions: input.conditions,
        ...(input.workDone ? { workDone: input.workDone } : {}),
        ...(input.note ? { note: input.note } : {}),
        photoAttachmentIds: input.photoIds,
        voiceAttachmentIds: input.voiceIds,
      },
      label: `Daily log ${day}`,
      dependsOn: mine && mine.id !== clientId ? pendingDeps(db, [mine.id]) : [],
      writes: [{ table: 'daily_logs', row }],
    },
    now,
  );
}
