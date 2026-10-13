/**
 * Permission keys from the server (`/auth/me`, login results and every `/sync/pull` → `access`).
 * The screens hide what the person can't use; the server checks again and answers
 * PERMISSION_DENIED (REST 403 / a REJECTED sync entry) when the phone is out of date.
 */
import type { components } from '../api/schema';

export type Role = 'THEKEDAR' | 'PM' | 'MUNSHI';

type AuthResult = components['schemas']['AuthResult'];
export type FieldAccess = components['schemas']['FieldAccess'];

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
    fieldAccess: { rates: !!s.fieldAccess.rates, amounts: !!s.fieldAccess.amounts, profit: !!s.fieldAccess.profit, contract: !!s.fieldAccess.contract },
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
} as const;

const fieldOf = (key: string): FieldKey | null => {
  const m = /^fields\.(rates|amounts|profit|contract)$/.exec(key);
  return m ? (m[1] as FieldKey) : null;
};

/**
 * May this person use `key` (a catalogue key, a `fields.*` key or an old legacy name)?
 * THEKEDAR: always. No access block yet (signed in on an older build, before the first
 * /auth/me or pull): the old behaviour — every action, and rates for everyone but a munshi.
 */
export function can(access: Access | null | undefined, role: Role | null | undefined, key: string): boolean {
  if (role === 'THEKEDAR') return true;
  const k = LEGACY_KEYS[key] ?? key;
  const field = fieldOf(k);
  if (!access) return field ? field === 'rates' && role !== 'MUNSHI' : true;
  if (field) return access.fieldAccess[field] || access.permissions.includes(k);
  return access.permissions.includes(k);
}

export const canAny = (access: Access | null | undefined, role: Role | null | undefined, keys: readonly string[]) => keys.some((k) => can(access, role, k));

/** Will the API send this kind of value (rates / amounts / profit / contract)? */
export const seesField = (access: Access | null | undefined, role: Role | null | undefined, field: FieldKey) => can(access, role, `fields.${field}`);

/** Account-type rules that stay with the role (not configurable), combined with the keys. */
export const rules = {
  /** Daily rate on "Naya mazdoor": needs the rates field (a default munshi never has it). */
  setWorkerRate: (a: Access | null | undefined, role: Role) => can(a, role, 'fields.rates'),
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
};

/** The tabs: shown when the person may use anything on them. */
export const TAB_PERMS = {
  hazri: [PERM.hazriView, PERM.hazriMark, PERM.workerCreate, PERM.peshgiCreate, PERM.measurementCreate, PERM.settlementView],
  maal: [PERM.dispatchView, PERM.receive, PERM.usageCreate, PERM.ownerDeliveryCreate, PERM.purchaseCreate, PERM.countCreate, PERM.stockView],
  kharcha: [PERM.cashView, PERM.expenseView, PERM.expenseCreate, PERM.topupCreate],
} as const;

/** Unknown paths (tabs, sync problems, notifications) are always allowed. */
export function routeAllowed(access: Access | null | undefined, role: Role | null | undefined, pathname: string): boolean {
  const keys = ROUTE_PERMS[pathname.replace(/\/+$/, '')];
  return !keys || canAny(access, role, keys);
}
