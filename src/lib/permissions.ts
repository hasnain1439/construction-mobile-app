/**
 * Permission keys from the server (`/auth/me`, login results and every `/sync/pull` → `access`).
 * The screens hide what the person can't use; the server checks again and answers
 * PERMISSION_DENIED (REST 403 / a REJECTED sync entry) when the phone is out of date.
 */
import type { components } from '../api/schema';

export type Role = 'THEKEDAR' | 'PM' | 'MUNSHI';

type AuthResult = components['schemas']['AuthResult'];
/**
 * `wages` (decision 4, `fields.wages`): worker daily wages. Optional until every server sends it —
 * an older server leaves it out, and then the rows decide (a rate is shown only when it is there).
 */
export type FieldAccess = Omit<components['schemas']['FieldAccess'], 'wages'> & { wages?: boolean };

/** The access block as the API sends it (same shape in /auth/me, login and sync pull). */
export interface Access {
  permissions: string[];
  legacyPermissions?: string[];
  fieldAccess: FieldAccess;
  scopes?: AuthResult['scopes'];
  approvalLimits?: AuthResult['approvalLimits'];
  permissionRole?: AuthResult['permissionRole'];
}

export type FieldKey = keyof FieldAccess;

/** Picks the access block out of a login / me / pull answer (null when an old server sent none). */
export function accessFrom(src: unknown): Access | null {
  if (!src || typeof src !== 'object') return null;
  const s = src as Partial<Access>;
  if (!Array.isArray(s.permissions) || !s.fieldAccess || typeof s.fieldAccess !== 'object') return null;
  return {
    permissions: s.permissions.filter((p): p is string => typeof p === 'string'),
    legacyPermissions: Array.isArray(s.legacyPermissions) ? s.legacyPermissions : [],
    fieldAccess: {
      rates: !!s.fieldAccess.rates,
      amounts: !!s.fieldAccess.amounts,
      profit: !!s.fieldAccess.profit,
      contract: !!s.fieldAccess.contract,
      ...(typeof s.fieldAccess.wages === 'boolean' ? { wages: s.fieldAccess.wages } : {}),
    },
    scopes: s.scopes ?? {},
    approvalLimits: s.approvalLimits ?? {},
    permissionRole: s.permissionRole ?? null,
  };
}

/** The old 8 coarse names → the catalogue key that replaces each (old checks keep working). */
export const LEGACY_KEYS: Record<string, string> = {
  'company.update': 'company.settings.manage',
  'users.manage': 'team.member.manage',
  'billing.view': 'billing.invoice.view',
  'profit.view': 'fields.profit',
  'rates.view': 'fields.rates',
  'store.manage': 'inventory.store.manage',
  'projects.manage': 'projects.project.edit',
  'site.entry': 'labor.attendance.create',
};

/** What each part of the app needs (PERMISSIONS_API.md §5 "Mobile tabs"). */
export const PERM = {
  hazriView: 'labor.attendance.view',
  hazriMark: 'labor.attendance.create',
  workerCreate: 'masterdata.worker.create',
  peshgiView: 'labor.advance.view',
  peshgiCreate: 'labor.advance.create',
  measurementView: 'labor.measurement.view',
  measurementCreate: 'labor.measurement.create',
  settlementView: 'labor.settlement.view',
  settlementCreate: 'labor.settlement.create',
  wagePay: 'labor.wagepayment.create',
  dispatchView: 'procurement.dispatch.view',
  purchaseView: 'procurement.purchase.view',
  purchaseCreate: 'procurement.purchase.create',
  receive: 'procurement.receiving.create',
  usageCreate: 'inventory.usage.create',
  ownerDeliveryCreate: 'inventory.ownerdelivery.create',
  countCreate: 'inventory.count.create',
  stockView: 'inventory.stock.view',
  cashView: 'cashbook.account.view',
  expenseView: 'cashbook.expense.view',
  expenseCreate: 'cashbook.expense.create',
  topupView: 'cashbook.topup.view',
  topupCreate: 'cashbook.topup.create',
  logView: 'dailylog.log.view',
  logCreate: 'dailylog.log.create',
  // Step 13 · schedule
  planView: 'schedule.plan.view',
  progressEdit: 'schedule.progress.edit',
  stoppageCreate: 'schedule.stoppage.create',
  // Step 15 · site instructions (without `.view` the munshi sees his own)
  instructionCreate: 'changeorder.instruction.create',
  instructionView: 'changeorder.instruction.view',
  // Step 16 · equipment & shuttering
  equipmentView: 'equipment.view',
  equipmentReceive: 'equipment.receiving.create',
  equipmentLoss: 'equipment.loss.create',
  // Step 17 · closeout
  snagView: 'closeout.snag.view',
  snagCreate: 'closeout.snag.create',
  snagManage: 'closeout.snag.manage',
  drawingView: 'closeout.drawing.view',
} as const;

/**
 * Keys the phone never offers, whatever the role (even THEKEDAR): product decision — projects are
 * created on the web only. Viewing / editing projects still follow their own keys.
 */
export const WEB_ONLY_KEYS: readonly string[] = ['projects.project.create'];

const fieldOf = (key: string): FieldKey | null => {
  const m = /^fields\.(rates|amounts|profit|contract|wages)$/.exec(key);
  return m ? (m[1] as FieldKey) : null;
};

/**
 * May this person use `key` (a catalogue key, a `fields.*` key or an old legacy name)?
 * THEKEDAR: always (except the `WEB_ONLY_KEYS`). No access block yet (signed in on an older build, before the first
 * /auth/me or pull): the old behaviour — every action, and rates for everyone but a munshi.
 * `fields.wages` from a server that doesn't send `fieldAccess.wages` yet: allowed — that server
 * still decides by sending the rate or not, and a missing rate is never shown.
 */
export function can(access: Access | null | undefined, role: Role | null | undefined, key: string): boolean {
  const k = LEGACY_KEYS[key] ?? key;
  if (WEB_ONLY_KEYS.includes(k)) return false;
  if (role === 'THEKEDAR') return true;
  const field = fieldOf(k);
  if (!access) return field ? field === 'wages' || (field === 'rates' && role !== 'MUNSHI') : true;
  if (field === 'wages' && access.fieldAccess.wages === undefined) return true;
  if (field) return !!access.fieldAccess[field] || access.permissions.includes(k);
  return access.permissions.includes(k);
}

export const canAny = (access: Access | null | undefined, role: Role | null | undefined, keys: readonly string[]) => keys.some((k) => can(access, role, k));

/** Will the API send this kind of value (rates / amounts / profit / contract)? */
export const seesField = (access: Access | null | undefined, role: Role | null | undefined, field: FieldKey) => can(access, role, `fields.${field}`);

/** May this person see worker daily wages (`fields.wages`, decision 4; ON by default for a munshi)? */
export const canSeeWages = (access: Access | null | undefined, role: Role | null | undefined) => can(access, role, 'fields.wages');

/**
 * A worker / worker-type rate to show, or null: needs `fields.wages` AND the value in the row
 * (without the key the server leaves the rate out — never shown as "Rs 0").
 */
export function visibleRate(access: Access | null | undefined, role: Role | null | undefined, paisa: unknown): string | null {
  if (!canSeeWages(access, role)) return null;
  return typeof paisa === 'string' && /^\d+$/.test(paisa) ? paisa : null;
}

/** Account-type rules that stay with the role (not configurable), combined with the keys. */
export const rules = {
  /**
   * Daily rate on "Naya mazdoor": needs the rates field (a default munshi never has it) and
   * `fields.wages` (without it the server rejects a WORKER_CREATE that carries a rate).
   */
  setWorkerRate: (a: Access | null | undefined, role: Role) => can(a, role, 'fields.rates') && canSeeWages(a, role),
  payWages: (a: Access | null | undefined, role: Role) => can(a, role, PERM.wagePay),
  seeSubcontractRates: (a: Access | null | undefined, role: Role) => can(a, role, 'fields.rates'),
  /** The owner sends cash, he doesn't ask for it. */
  requestTopup: (a: Access | null | undefined, role: Role) => role !== 'THEKEDAR' && can(a, role, PERM.topupCreate),
};

/** Stack screens and the key each needs (a hidden button can still be reached by a link or the back stack). */
export const ROUTE_PERMS: Record<string, readonly string[]> = {
  '/hazri/worker-new': [PERM.workerCreate],
  '/hazri/peshgi': [PERM.peshgiCreate],
  '/hazri/measurement': [PERM.measurementCreate],
  '/hazri/settlement': [PERM.settlementView],
  '/maal/receive': [PERM.receive],
  '/maal/usage': [PERM.usageCreate],
  '/maal/owner-delivery': [PERM.ownerDeliveryCreate],
  '/maal/purchase': [PERM.purchaseCreate],
  '/maal/count': [PERM.countCreate],
  '/kharcha/new': [PERM.expenseCreate],
  '/kharcha/topup': [PERM.topupCreate],
  '/log/today': [PERM.logCreate],
  '/log/history': [PERM.logView],
  '/maal/equipment': [PERM.equipmentView],
  '/maal/equipment-receive': [PERM.equipmentReceive],
  '/maal/equipment-loss': [PERM.equipmentLoss],
  '/site/milestones': [PERM.planView],
  '/site/milestone': [PERM.planView],
  '/site/stoppages': [PERM.planView, PERM.stoppageCreate],
  '/site/stoppage-new': [PERM.stoppageCreate],
  '/site/instructions': [PERM.instructionCreate, PERM.instructionView],
  '/site/instruction-new': [PERM.instructionCreate],
  '/site/snags': [PERM.snagView],
  '/site/snag-new': [PERM.snagCreate],
  '/site/snag-fix': [PERM.snagCreate],
  '/site/drawings': [PERM.drawingView],
  '/site/drawing': [PERM.drawingView],
};

/** The tabs: shown when the person may use anything on them. */
export const TAB_PERMS = {
  hazri: [PERM.hazriView, PERM.hazriMark, PERM.workerCreate, PERM.peshgiCreate, PERM.measurementCreate, PERM.settlementView],
  maal: [PERM.dispatchView, PERM.receive, PERM.usageCreate, PERM.ownerDeliveryCreate, PERM.purchaseCreate, PERM.countCreate, PERM.stockView, PERM.equipmentView, PERM.equipmentReceive, PERM.equipmentLoss],
  kharcha: [PERM.cashView, PERM.expenseView, PERM.expenseCreate, PERM.topupCreate],
  /** Not a tab: the attendance list on Hazri (day / week). Without these the tab only shows its other actions. */
  attendance: [PERM.hazriView, PERM.hazriMark],
  /** Not a tab: "Incoming" on Maal (deliveries and equipment on the way). */
  incoming: [PERM.dispatchView, PERM.purchaseView, PERM.receive, PERM.equipmentView, PERM.equipmentReceive],
  /** Not a tab: the "Site" group on Mazeed and the Aaj cards (progress, stoppages, instructions, snags, drawings). */
  site: [PERM.planView, PERM.progressEdit, PERM.stoppageCreate, PERM.instructionCreate, PERM.instructionView, PERM.snagView, PERM.snagCreate, PERM.drawingView],
} as const;

/** Unknown paths (tabs, sync problems, notifications) are always allowed. */
export function routeAllowed(access: Access | null | undefined, role: Role | null | undefined, pathname: string): boolean {
  const keys = ROUTE_PERMS[pathname.replace(/\/+$/, '')];
  return !keys || canAny(access, role, keys);
}
