/**
 * "Office" on the phone — a mini dashboard of the web's office side, per role: company overview,
 * projects (view only — never created on the phone), reports, team, suppliers, customers and
 * products. Every section follows the same permission keys as the web, so the owner sees all of it,
 * a PM / administrator / accountant what their role allows, and a default munshi none of it.
 *
 * Online only: these read the REST API (the phone's database holds the site data, not the office's).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, NetworkError, request } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { TKey } from '../i18n/en';
import { can, type Access, type Role } from '../lib/permissions';

export const OFFICE_PERM = {
  overview: 'dashboard.overview.view',
  reports: 'finance.reports.view',
  companyReports: 'finance.companyreports.view',
  team: 'team.member.view',
  teamManage: 'team.member.manage',
  suppliers: 'masterdata.supplier.view',
  customers: 'clients.client.view',
  products: 'masterdata.material.view',
} as const;

export type OfficeSection = 'overview' | 'projects' | 'reports' | 'team' | 'suppliers' | 'customers' | 'products';

/** Which sections this person may open (products only alongside another office section). */
export function officeSections(access: Access | null | undefined, role: Role | null | undefined): OfficeSection[] {
  const has = (k: string) => can(access, role, k);
  const out: OfficeSection[] = [];
  if (has(OFFICE_PERM.overview)) out.push('overview', 'projects');
  if (has(OFFICE_PERM.reports) && reportsFor(access, role).length) out.push('reports');
  if (has(OFFICE_PERM.team) || has(OFFICE_PERM.teamManage)) out.push('team');
  if (has(OFFICE_PERM.suppliers)) out.push('suppliers');
  if (has(OFFICE_PERM.customers)) out.push('customers');
  if (out.length && has(OFFICE_PERM.products)) out.push('products');
  return out;
}

/** Keys that put the Office tab on the bar (any section). */
export const OFFICE_TAB_KEYS: readonly string[] = [OFFICE_PERM.overview, OFFICE_PERM.reports, OFFICE_PERM.team, OFFICE_PERM.teamManage, OFFICE_PERM.suppliers, OFFICE_PERM.customers];

// ---------- reports: the web's list and access rules ----------

export interface ReportDef {
  name: string;
  title: TKey;
  /** Every key needed besides finance.reports.view (fields.* = field access). */
  needs: readonly string[];
}

export const REPORTS: readonly ReportDef[] = [
  { name: 'project-summary', title: 'office.rep.project-summary', needs: ['fields.amounts'] },
  { name: 'receivables-ageing', title: 'office.rep.receivables-ageing', needs: [OFFICE_PERM.companyReports] },
  { name: 'supplier-ageing', title: 'office.rep.supplier-ageing', needs: [OFFICE_PERM.companyReports] },
  { name: 'cash-book', title: 'office.rep.cash-book', needs: [] },
  { name: 'labor-peshgi', title: 'office.rep.labor-peshgi', needs: [] },
  { name: 'material-audit', title: 'office.rep.material-audit', needs: [] },
  { name: 'stock-valuation', title: 'office.rep.stock-valuation', needs: [OFFICE_PERM.companyReports] },
  { name: 'delay-analysis', title: 'office.rep.delay-analysis', needs: ['control.view'] },
  { name: 'variance', title: 'office.rep.variance', needs: ['control.view'] },
  { name: 'change-orders', title: 'office.rep.change-orders', needs: ['changeorder.view'] },
  { name: 'equipment-utilisation', title: 'office.rep.equipment-utilisation', needs: ['equipment.view'] },
  { name: 'snags', title: 'office.rep.snags', needs: ['closeout.snag.view'] },
];

export function reportsFor(access: Access | null | undefined, role: Role | null | undefined): ReportDef[] {
  if (!can(access, role, OFFICE_PERM.reports)) return [];
  return REPORTS.filter((r) => r.needs.every((k) => can(access, role, k)));
}

// ---------- server shapes (typed by hand: what the screens read) ----------

export type ColumnType = 'text' | 'money' | 'qty' | 'int' | 'percent' | 'date';
export type Cell = string | number | null;
export interface ReportTable {
  title: string;
  subtitle: string | null;
  columns: { key: string; label: string; type: ColumnType }[];
  rows: Record<string, Cell>[];
  totals: Record<string, Cell> | null;
  notes?: string[];
}
export interface ReportFile {
  url: string;
  fileName: string;
}

export interface Overview {
  seesFinancials: boolean;
  kpis: {
    activeProjects: { count: number; atRisk: number; delayed: number };
    pendingApprovals: number | { total?: number; count?: number };
    openShortages: number;
    dispatchesOnTheWay: number;
    receivablesOutstandingPaisa?: string;
    overduePaisa?: string;
    collectedPercent?: number;
    invoicedPaisa?: string;
    receivedPaisa?: string;
    supplierUdhaarPaisa?: string;
    storeStockValuePaisa?: string;
    cashWithSiteStaffPaisa?: string;
    ownMoneyInvestedPaisa?: string;
  };
  projects: {
    project: { id: string; code: string; name: string; status: string };
    client: { id: string; name: string } | null;
    contractPaisa?: string;
    invoicedPaisa?: string;
    receivedPaisa?: string;
    outstandingPaisa?: string;
    overduePaisa?: string;
    percentBilled?: number;
    progressPercent?: number;
    atRisk?: boolean;
  }[];
}

export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  permissionRole?: { key?: string | null; name: string } | null;
  lastActiveAt?: string | null;
}
export interface Supplier {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  city: string | null;
  isActive: boolean;
  udhaarBalancePaisa?: string;
  oldestUnpaidDays?: number | null;
}
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city?: string | null;
}
export interface Product {
  id: string;
  name: string;
  unit: string;
  group: { name: string };
  brand?: { name: string } | null;
  quality?: { name: string } | null;
  isHidden: boolean;
}

/** Number of approvals waiting, whatever shape the overview sends. */
export const approvalsCount = (v: Overview['kpis']['pendingApprovals']) => (typeof v === 'number' ? v : (v?.total ?? v?.count ?? 0));

// ---------- loading ----------

export type LoadState = 'loading' | 'ready' | 'offline' | 'denied' | 'error';

/**
 * GET on open and whenever path / query change (a search keeps the last list until the new one
 * arrives); `reload` shows the spinner again. Offline / denied / error kept apart so the screen can
 * say why.
 */
export function useOnline<T>(path: string | null, query?: Record<string, string | number | undefined>) {
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<T | null>(null);
  const key = path ? `${path}?${JSON.stringify(query ?? {})}` : null;
  const seq = useRef(0);
  const fetchNow = useCallback(
    (): Promise<void> => {
      if (!path) return Promise.resolve();
      const mine = ++seq.current;
      return request<T>(path, { query }).then(
        (body) => {
          if (mine !== seq.current) return;
          setData(body);
          setState('ready');
        },
        (e: unknown) => {
          if (mine !== seq.current) return;
          setState(e instanceof NetworkError ? 'offline' : e instanceof ApiError && (e.status === 403 || e.status === 404) ? 'denied' : 'error');
        },
      );
    },
    // `key` stands for path + query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => {
    void fetchNow();
  }, [fetchNow]);
  const reload = useCallback(async () => {
    setState('loading');
    await fetchNow();
  }, [fetchNow]);
  return { state, data, reload };
}

/** A report file (PDF) for sharing: the API stores it and answers with a signed link. */
export const reportFile = (name: string, format: 'pdf' | 'xlsx') => request<ReportFile>(ENDPOINTS.report(name), { query: { format } });
