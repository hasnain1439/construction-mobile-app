/** Read helpers over the local mirror — plain functions of the database so they are easy to test. */
import { getRow, listRows } from '../db/store';
import type { Db } from '../db/types';
import { addDays, weekOf, type WeekDay } from '../lib/dates';
import { toPaisa } from '../lib/money';
import type {
  AdvanceRow,
  AssignmentRow,
  AttendanceRow,
  CashAccountRow,
  CashEntryRow,
  DailyLogRow,
  DispatchRow,
  LocationRow,
  MaterialRow,
  ProjectRow,
  ProjectWorkerRow,
  PurchaseRow,
  SettingsRow,
  SettlementRow,
  SiteStockRow,
  TopupRow,
  WorkerRow,
} from './types';

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export const projects = (db: Db) => listRows<ProjectRow>(db, 'projects').sort(byName);
export const project = (db: Db, id: string | null) => (id ? getRow<ProjectRow>(db, 'projects', id) : null);

export function settings(db: Db): SettingsRow {
  return (
    listRows<SettingsRow>(db, 'settings')[0] ?? {
      id: 'default',
      blindCountEnabled: true,
      kharchaApprovalLimitPaisa: '2500000',
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      settlementWeekStart: 'MONDAY',
      hoursPerDay: 8,
      missingLogAlertTime: '18:00',
    }
  );
}

export const siteLocation = (db: Db, projectId: string) => listRows<LocationRow>(db, 'stock_locations', projectId).find((l) => l.type === 'SITE') ?? null;

export const materials = (db: Db) => listRows<MaterialRow>(db, 'materials').filter((m) => !m.isHidden).sort(byName);
export const materialMap = (db: Db) => new Map(listRows<MaterialRow>(db, 'materials').map((m) => [m.id, m]));

/** Workers on the site (active assignment) with their worker record. */
export function siteWorkers(db: Db, projectId: string): { pw: ProjectWorkerRow; worker: WorkerRow }[] {
  const workers = new Map(listRows<WorkerRow>(db, 'workers').map((w) => [w.id, w]));
  return listRows<ProjectWorkerRow>(db, 'project_workers', projectId)
    .filter((pw) => pw.isActive)
    .flatMap((pw) => {
      const worker = workers.get(pw.workerId);
      return worker && worker.isActive ? [{ pw, worker }] : [];
    })
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name));
}

export const attendanceOn = (db: Db, projectId: string, day: string) => listRows<AttendanceRow>(db, 'attendance', projectId).filter((a) => a.date === day);

export function attendanceBetween(db: Db, projectId: string, from: string, to: string) {
  return listRows<AttendanceRow>(db, 'attendance', projectId).filter((a) => a.date >= from && a.date <= to);
}

export const assignments = (db: Db, projectId: string) => listRows<AssignmentRow>(db, 'subcontract_assignments', projectId).filter((a) => a.isActive);
export const advances = (db: Db, projectId: string) => listRows<AdvanceRow>(db, 'advances', projectId).sort((a, b) => b.date.localeCompare(a.date));

export function settlementFor(db: Db, projectId: string, weekStart: string) {
  return listRows<SettlementRow>(db, 'settlements', projectId).find((s) => s.weekStart === weekStart) ?? null;
}

/** A week is locked for hazri once its wages were sent for approval. */
export function weekLocked(db: Db, projectId: string, day: string) {
  const s = settings(db);
  const w = weekOf(day, s.settlementWeekStart as WeekDay);
  const st = settlementFor(db, projectId, w.weekStart);
  return !!st && st.status !== 'DRAFT' && st.status !== 'RETURNED';
}

export const incomingDispatches = (db: Db, projectId: string) => listRows<DispatchRow>(db, 'dispatches', projectId).filter((d) => d.status === 'ON_THE_WAY');
export const incomingPurchases = (db: Db, projectId: string) => listRows<PurchaseRow>(db, 'purchases', projectId).filter((p) => p.status === 'PENDING_RECEIPT');

export function siteStock(db: Db, projectId: string): (SiteStockRow & { material: MaterialRow | undefined })[] {
  const loc = siteLocation(db, projectId);
  if (!loc) return [];
  const mats = materialMap(db);
  return listRows<SiteStockRow>(db, 'site_stock')
    .filter((s) => s.locationId === loc.id)
    .map((s) => ({ ...s, material: mats.get(s.materialId) }))
    .sort((a, b) => (a.material?.name ?? '').localeCompare(b.material?.name ?? ''));
}

export const stockOf = (db: Db, locationId: string, materialId: string) => getRow<SiteStockRow>(db, 'site_stock', `${locationId}:${materialId}`);

export const cashAccount = (db: Db) => listRows<CashAccountRow>(db, 'cash_accounts').find((a) => a.isActive) ?? listRows<CashAccountRow>(db, 'cash_accounts')[0] ?? null;

export function cashEntries(db: Db, accountId: string | undefined) {
  if (!accountId) return [];
  return listRows<CashEntryRow>(db, 'cash_entries')
    .filter((e) => e.accountId === accountId)
    .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));
}

export const pendingFloats = (db: Db, accountId: string | undefined) => cashEntries(db, accountId).filter((e) => e.status === 'PENDING_ACK');
export const topups = (db: Db) => listRows<TopupRow>(db, 'topup_requests').sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

export const dailyLogs = (db: Db, projectId: string) => listRows<DailyLogRow>(db, 'daily_logs', projectId).sort((a, b) => b.logDate.localeCompare(a.logDate));
export const myLogOn = (db: Db, projectId: string, userId: string, day: string) => dailyLogs(db, projectId).find((l) => l.authorId === userId && l.logDate === day) ?? null;

export const isEnoughCash = (account: CashAccountRow | null, amountPaisa: string) => !!account && toPaisa(account.balancePaisa) >= toPaisa(amountPaisa);

/** The settlement week before the one containing `day`. */
export const previousWeekStart = (day: string, weekStart: WeekDay) => weekOf(addDays(weekOf(day, weekStart).weekStart, -1), weekStart).weekStart;
