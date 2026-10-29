/**
 * "Meri approvals" on the phone — what a PM / administrator / owner can approve on the web.
 *
 * Approvals are online only: sync push has no approve mutations, so every decision goes through
 * REST and the next sync pull brings the result into the phone's database.
 *  - Wages, kharcha, top-ups, measurements: the server inbox (GET /approvals, needs
 *    approvals.inbox.view; the server already filters by scope and approve key) and its quick
 *    actions (POST /approvals/bulk with one item — the owning module applies limits, own-kharcha …).
 *  - Stoppage days (schedule.stoppage.approve) and fixed snags (closeout.snag.manage): not in the
 *    server inbox; taken from the synced rows and decided via /stoppages/:id/approve|reject and
 *    /snags/:id/verify|reopen.
 * Billing items (stages, invoices, cheques) and open shortages / purchases without rates stay on the web.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, NetworkError, request } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { useQuery } from '../db/live';
import { listRows } from '../db/store';
import type { Db } from '../db/types';
import type { TKey } from '../i18n/en';
import { APPROVE_KEYS, PERM, can, canAny, seesField, type Access, type Role } from '../lib/permissions';
import { usePermissions } from './access';
import type { SnagRow, StoppageRow } from './types';

// ---------- server shapes (GET /approvals, POST /approvals/bulk — typed by hand, the generated schema has no body types for them) ----------

export type ServerAction = 'approve' | 'reject' | 'return' | 'verify' | 'issue' | 'clear' | 'bounce';
export interface ServerQuickAction {
  action: ServerAction;
  label: string;
  needsNote: boolean;
  needsMethod: boolean;
}
export interface ServerApprovalItem {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  project: { id: string; code: string; name: string } | null;
  amountPaisa: string | null;
  createdAt: string;
  ageDays: number;
  actionUrl: string;
  quickActions: ServerQuickAction[];
}
export interface ApprovalsResponse {
  total: number;
  groups: { type: string; label: string; count: number; totalPaisa: string | null; items: ServerApprovalItem[] }[];
}
export interface BulkResult {
  succeeded: number;
  failed: number;
  results: { type: string; id: string; action: string; ok: boolean; error: { code: string; message: string } | null }[];
}
export type FloatMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA';
export const FLOAT_METHODS: readonly FloatMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA'];

// ---------- what the phone covers ----------

/** Server inbox types the phone acts on (the rest stay on the web). */
export const INBOX_KINDS = ['SETTLEMENT_SUBMITTED', 'EXPENSE_PENDING_APPROVAL', 'TOPUP_PENDING', 'MEASUREMENT_TO_VERIFY'] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];
export type ApprovalKind = InboxKind | 'STOPPAGE_PENDING' | 'SNAG_TO_VERIFY';
/** Display order of the groups. */
export const APPROVAL_KINDS: readonly ApprovalKind[] = [...INBOX_KINDS, 'STOPPAGE_PENDING', 'SNAG_TO_VERIFY'];

/** The key that decides each kind (the server checks it again). */
export const APPROVE_KEY: Record<ApprovalKind, string> = {
  SETTLEMENT_SUBMITTED: PERM.settlementApprove,
  EXPENSE_PENDING_APPROVAL: PERM.expenseApprove,
  TOPUP_PENDING: PERM.topupApprove,
  MEASUREMENT_TO_VERIFY: PERM.measurementApprove,
  STOPPAGE_PENDING: PERM.stoppageApprove,
  SNAG_TO_VERIFY: PERM.snagManage,
};

/** Kinds whose approve has an approval limit (PERMISSIONS_API.md §4). */
const LIMITED: ReadonlySet<ApprovalKind> = new Set(['SETTLEMENT_SUBMITTED', 'EXPENSE_PENDING_APPROVAL', 'TOPUP_PENDING', 'MEASUREMENT_TO_VERIFY']);

export const APPROVAL_ICON: Record<ApprovalKind, string> = {
  SETTLEMENT_SUBMITTED: '🗓️',
  EXPENSE_PENDING_APPROVAL: '💵',
  TOPUP_PENDING: 'wallet-outline',
  MEASUREMENT_TO_VERIFY: 'ruler',
  STOPPAGE_PENDING: 'weather-pouring',
  SNAG_TO_VERIFY: 'map-marker-alert-outline',
};

const APPROVE_LABEL: Record<ApprovalKind, TKey> = {
  SETTLEMENT_SUBMITTED: 'appr.approve',
  EXPENSE_PENDING_APPROVAL: 'appr.approve',
  TOPUP_PENDING: 'appr.send',
  MEASUREMENT_TO_VERIFY: 'appr.verify',
  STOPPAGE_PENDING: 'appr.approve',
  SNAG_TO_VERIFY: 'appr.verify',
};
const DECLINE_LABEL: Record<ApprovalKind, TKey> = {
  SETTLEMENT_SUBMITTED: 'appr.return',
  EXPENSE_PENDING_APPROVAL: 'appr.reject',
  TOPUP_PENDING: 'appr.reject',
  MEASUREMENT_TO_VERIFY: 'appr.reject',
  STOPPAGE_PENDING: 'appr.reject',
  SNAG_TO_VERIFY: 'appr.reopen',
};

/** Reject / return / reopen need a reason of at least this many letters (same as the server). */
export const NOTE_MIN = 3;

export type PhoneActionKind = 'approve' | 'reject' | 'return';
export interface PhoneAction {
  action: PhoneActionKind;
  label: TKey;
  decline: boolean;
  needsNote: boolean;
  needsMethod: boolean;
  /** Approve above the person's approval limit: shown disabled with the reason. */
  overLimit: boolean;
}
export interface PhoneApproval {
  kind: ApprovalKind;
  id: string;
  title: string;
  subtitle: string | null;
  projectName: string | null;
  /** null = not shown (no amount, or the person may not see it). */
  amountPaisa: string | null;
  createdAt: string;
  ageDays: number;
  actions: PhoneAction[];
  /** The person's limit when `overLimit` (paisa string). */
  limitPaisa: string | null;
}

// ---------- permissions & limits ----------

/** Does this person approve anything on the phone (entry points)? */
export const canApproveAnything = (access: Access | null | undefined, role: Role | null | undefined) => canAny(access, role, APPROVE_KEYS);

/** May the server inbox be read (and its quick actions run)? */
export const canUseInbox = (access: Access | null | undefined, role: Role | null | undefined) =>
  can(access, role, PERM.approvalsInbox) && canAny(access, role, INBOX_KINDS.map((k) => APPROVE_KEY[k]));

/** Limit of a held key in paisa (string), null = no limit, undefined = key not held. Owner: never a limit. */
export function approvalLimitOf(access: Access | null | undefined, role: Role | null | undefined, key: string): string | null | undefined {
  if (!can(access, role, key)) return undefined;
  if (role === 'THEKEDAR') return null;
  return access?.approvalLimits?.[key] ?? null;
}

/** Is `amountPaisa` within the person's limit for `key` (false when the key is not held)? */
export function withinLimit(access: Access | null | undefined, role: Role | null | undefined, key: string, amountPaisa: string | null | undefined): boolean {
  const limit = approvalLimitOf(access, role, key);
  if (limit === undefined) return false;
  if (limit === null || amountPaisa === null || amountPaisa === undefined) return true;
  try {
    return BigInt(amountPaisa) <= BigInt(limit);
  } catch {
    return true;
  }
}

/**
 * May the amount be shown? Wages and cash are shown wherever the app shows them; a measurement's
 * value is quantity × the sub-contract rate, so it follows `fields.rates` (like the measurement screen).
 */
export const showsAmount = (access: Access | null | undefined, role: Role | null | undefined, kind: ApprovalKind) => (kind === 'MEASUREMENT_TO_VERIFY' ? seesField(access, role, 'rates') : true);

const isInboxKind = (t: string): t is InboxKind => (INBOX_KINDS as readonly string[]).includes(t);

function actionsFor(access: Access | null | undefined, role: Role | null | undefined, kind: ApprovalKind, amountPaisa: string | null, server: Pick<ServerQuickAction, 'action' | 'needsNote' | 'needsMethod'>[]): { actions: PhoneAction[]; limitPaisa: string | null } {
  const key = APPROVE_KEY[kind];
  const overLimit = LIMITED.has(kind) && !withinLimit(access, role, key, amountPaisa);
  const actions: PhoneAction[] = [];
  for (const qa of server) {
    const approve = qa.action === 'approve' || qa.action === 'verify';
    const decline = qa.action === 'reject' || qa.action === 'return';
    if (!approve && !decline) continue;
    actions.push({
      action: approve ? 'approve' : (qa.action as PhoneActionKind),
      label: approve ? APPROVE_LABEL[kind] : DECLINE_LABEL[kind],
      decline,
      needsNote: decline || qa.needsNote,
      needsMethod: qa.needsMethod,
      overLimit: approve && overLimit,
    });
  }
  return { actions, limitPaisa: overLimit ? (approvalLimitOf(access, role, key) ?? null) : null };
}

/** The server inbox → the items the phone shows (supported kinds the person holds the key for). */
export function fromServer(res: ApprovalsResponse | null | undefined, access: Access | null | undefined, role: Role | null | undefined): PhoneApproval[] {
  const out: PhoneApproval[] = [];
  for (const g of res?.groups ?? []) {
    for (const i of g.items) {
      if (!isInboxKind(i.type) || !can(access, role, APPROVE_KEY[i.type])) continue;
      const { actions, limitPaisa } = actionsFor(access, role, i.type, i.amountPaisa, i.quickActions);
      out.push({
        kind: i.type,
        id: i.id,
        title: i.title,
        subtitle: i.subtitle,
        projectName: i.project?.name ?? null,
        amountPaisa: showsAmount(access, role, i.type) ? i.amountPaisa : null,
        createdAt: i.createdAt,
        ageDays: i.ageDays,
        actions,
        limitPaisa,
      });
    }
  }
  return out;
}

const DAY_MS = 86_400_000;
const ageOf = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS)) || 0;

type Translate = (key: TKey, vars?: Record<string, string | number>) => string;

/** Pending stoppage days and fixed snags from the synced rows (rows not yet on the server are left out). */
export function localApprovals(
  db: Db,
  access: Access | null | undefined,
  role: Role | null | undefined,
  text: { t: Translate; shortDate: (d: string) => string },
  now = Date.now(),
): PhoneApproval[] {
  const projects = new Map(listRows<{ id: string; name: string }>(db, 'projects').map((p) => [p.id, p.name]));
  const out: PhoneApproval[] = [];
  if (can(access, role, PERM.stoppageApprove)) {
    const rows = listRows<StoppageRow>(db, 'stoppages').filter((s) => s.status === 'PENDING' && !s.pendingSync);
    rows.sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
    for (const s of rows) {
      const from = s.dates[0] ?? '';
      const to = s.dates[s.dates.length - 1] ?? from;
      out.push({
        kind: 'STOPPAGE_PENDING',
        id: s.id,
        title: text.t(`stopreason.${s.reason}` as TKey),
        subtitle: [text.t('stop.range', { from: text.shortDate(from), to: text.shortDate(to), n: s.dates.length }), s.note].filter(Boolean).join(' · '),
        projectName: projects.get(s.projectId) ?? null,
        amountPaisa: null,
        createdAt: s.reportedAt,
        ageDays: ageOf(s.reportedAt, now),
        ...actionsFor(access, role, 'STOPPAGE_PENDING', null, [
          { action: 'approve', needsNote: false, needsMethod: false },
          { action: 'reject', needsNote: true, needsMethod: false },
        ]),
      });
    }
  }
  if (can(access, role, PERM.snagManage)) {
    const rows = listRows<SnagRow>(db, 'snags').filter((s) => s.status === 'FIXED' && !s.pendingSync);
    rows.sort((a, b) => (a.fixedAt ?? a.updatedAt).localeCompare(b.fixedAt ?? b.updatedAt));
    for (const s of rows) {
      const at = s.fixedAt ?? s.updatedAt;
      out.push({
        kind: 'SNAG_TO_VERIFY',
        id: s.id,
        title: s.description,
        subtitle: [s.code, s.location, s.fixNote].filter(Boolean).join(' · ') || null,
        projectName: projects.get(s.projectId) ?? null,
        amountPaisa: null,
        createdAt: at,
        ageDays: ageOf(at, now),
        ...actionsFor(access, role, 'SNAG_TO_VERIFY', null, [
          { action: 'approve', needsNote: false, needsMethod: false },
          { action: 'reject', needsNote: true, needsMethod: false },
        ]),
      });
    }
  }
  return out;
}

/** Items grouped in display order (empty groups left out). */
export function groupApprovals(items: PhoneApproval[]): { kind: ApprovalKind; items: PhoneApproval[] }[] {
  return APPROVAL_KINDS.map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) })).filter((g) => g.items.length > 0);
}

// ---------- REST ----------

export const fetchApprovals = () => request<ApprovalsResponse>(ENDPOINTS.approvals, { timeoutMs: 15_000 });

export interface ActionInput {
  note?: string;
  method?: FloatMethod;
}

/**
 * Runs one decision on the server. Throws NetworkError (offline) or ApiError with the server's
 * code (APPROVAL_LIMIT_EXCEEDED, PERMISSION_DENIED, NOTE_REQUIRED, OWN_EXPENSE, …).
 */
export async function runApproval(item: Pick<PhoneApproval, 'kind' | 'id'>, action: PhoneActionKind, input: ActionInput = {}): Promise<void> {
  const note = input.note?.trim();
  const decline = action !== 'approve';
  if (decline && (!note || note.length < NOTE_MIN)) throw new ApiError(400, 'NOTE_REQUIRED', 'Add a short note (why)');
  if (item.kind === 'TOPUP_PENDING' && !decline && !input.method) throw new ApiError(400, 'METHOD_REQUIRED', 'Choose how the cash is sent');
  if (item.kind === 'STOPPAGE_PENDING') {
    await request(`${ENDPOINTS.stoppages}/${item.id}/${decline ? 'reject' : 'approve'}`, { method: 'POST', body: decline ? { note } : {} });
    return;
  }
  if (item.kind === 'SNAG_TO_VERIFY') {
    await request(`${ENDPOINTS.snags}/${item.id}/${decline ? 'reopen' : 'verify'}`, { method: 'POST', body: decline ? { reason: note } : {} });
    return;
  }
  const res = await request<BulkResult>(ENDPOINTS.approvalsBulk, {
    method: 'POST',
    body: { items: [{ type: item.kind, id: item.id, action, ...(decline ? { note } : {}), ...(input.method && !decline ? { method: input.method } : {}) }] },
  });
  const r = res.results[0];
  if (!r || r.ok) return;
  const code = r.error?.code ?? 'generic';
  throw new ApiError(code === 'PERMISSION_DENIED' || code === 'APPROVAL_LIMIT_EXCEEDED' ? 403 : 400, code, r.error?.message ?? 'Failed');
}

/** 'OFFLINE' for no internet, else the server's error code (shown with errorText). */
export const approvalErrorCode = (err: unknown): string => (err instanceof NetworkError ? 'OFFLINE' : err instanceof ApiError ? err.code : 'generic');

// ---------- the count on Mazeed / Aaj ----------

let serverCount: number | null = null;
const listeners = new Set<() => void>();
/** Remembers how many server inbox items the person can act on (set by the inbox and the badge). */
export function setServerApprovalsCount(n: number | null) {
  serverCount = n;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getServerCount = () => serverCount;

/** Fetches the inbox once for the badge; offline / errors keep the last known count. */
export async function refreshServerApprovalsCount(access: Access | null | undefined, role: Role | null | undefined) {
  if (!canUseInbox(access, role)) return;
  try {
    setServerApprovalsCount(fromServer(await fetchApprovals(), access, role).length);
  } catch {
    // keep the last count
  }
}

/** Local pending stoppages / fixed snags the person may decide (no network needed). */
export function localApprovalsCount(db: Db, access: Access | null | undefined, role: Role | null | undefined): number {
  let n = 0;
  if (can(access, role, PERM.stoppageApprove)) n += listRows<StoppageRow>(db, 'stoppages').filter((s) => s.status === 'PENDING' && !s.pendingSync).length;
  if (can(access, role, PERM.snagManage)) n += listRows<SnagRow>(db, 'snags').filter((s) => s.status === 'FIXED' && !s.pendingSync).length;
  return n;
}

/** `{ show, count }` for the entry points: shown only to people with an approve key. */
export function useApprovalsCount(opts: { fetch?: boolean } = {}) {
  const p = usePermissions();
  const show = canApproveAnything(p.access, p.role);
  const local = useQuery((db) => (show ? localApprovalsCount(db, p.access, p.role) : 0), [show, p.access, p.role]);
  const server = useSyncExternalStore(subscribe, getServerCount, getServerCount);
  const fetchNow = opts.fetch ?? false;
  const inbox = show && canUseInbox(p.access, p.role);
  useEffect(() => {
    if (fetchNow && inbox) void refreshServerApprovalsCount(p.access, p.role);
    // Once per screen visit (and when the permissions change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNow, inbox]);
  return { show, count: local + (inbox ? (server ?? 0) : 0) };
}
