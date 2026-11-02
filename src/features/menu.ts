/**
 * The side menu (☰): the main parts of the app; a part with more screens opens to show them (its own
 * page first), like the web's sidebar. Only pages to look at: "add / new" forms open from a button on
 * their page, never from the menu. An entry with its own list (Reports) opens again inside the menu. Each entry only when the person may open it (the same keys the
 * routes and tabs use), so every role gets its own menu.
 */
import type { TKey } from '../i18n/en';
import { canAny, routeAllowed, TAB_PERMS, type Access, type Role } from '../lib/permissions';
import { OFFICE_TAB_KEYS, officeSections, reportsFor } from './office';

export interface MenuItem {
  key: string;
  label: TKey;
  icon: string;
  href: string;
  /** Opens to these inside the menu (no page of its own). */
  items?: MenuItem[];
}
/** A main entry: a plain link (no `items`) or a part that opens to its screens. */
export interface MenuGroup {
  key: string;
  title: TKey;
  icon: string;
  /** Its own page (a tab), listed first when the part is opened. */
  href?: string;
  items: MenuItem[];
}

const item = (href: string, label: TKey, icon: string): MenuItem => ({ key: href, label, icon, href });
export const reportHref = (name: string) => `/office/report?name=${name}`;

export function menuFor(access: Access | null | undefined, role: Role | null | undefined): MenuGroup[] {
  const route = (i: MenuItem) => routeAllowed(access, role, i.href);
  const office = officeSections(access, role);
  const tab = (keys: readonly string[], href: string) => (canAny(access, role, keys) ? href : undefined);
  const groups: MenuGroup[] = [
    { key: 'aaj', title: 'tabs.aaj', icon: 'home-variant-outline', href: '/aaj', items: [] },
    {
      key: 'hazri',
      title: 'tabs.hazri',
      icon: 'account-hard-hat-outline',
      href: tab(TAB_PERMS.hazri, '/hazri'),
      items: [item('/hazri/settlement', 'hazri.settlement', 'calendar-week')].filter(route),
    },
    { key: 'maal', title: 'tabs.maal', icon: 'wall', href: tab(TAB_PERMS.maal, '/maal'), items: [item('/maal/equipment', 'eq.title', 'crane')].filter(route) },
    { key: 'kharcha', title: 'tabs.kharcha', icon: 'wallet-outline', href: tab(TAB_PERMS.kharcha, '/kharcha'), items: [] },
    {
      key: 'site',
      title: 'menu.site',
      icon: 'hammer-wrench',
      items: [
        item('/log/today', 'mazeed.dailyLog', 'notebook-edit-outline'),
        item('/log/history', 'mazeed.myLogs', 'notebook-outline'),
        item('/site/milestones', 'site.progress', 'chart-gantt'),
        item('/site/stoppages', 'stop.list', 'weather-pouring'),
        item('/site/instructions', 'si.title', 'message-draw'),
        item('/site/snags', 'snag.title', 'map-marker-alert-outline'),
        item('/site/drawings', 'dwg.title', 'floor-plan'),
      ].filter(route),
    },
    {
      key: 'office',
      title: 'tabs.office',
      icon: 'briefcase-variant-outline',
      href: tab(OFFICE_TAB_KEYS, '/office'),
      items: [
        ...(office.includes('projects') ? [item('/office/projects', 'office.projects', 'office-building-outline')] : []),
        ...(office.includes('reports')
          ? [{ ...item('/office/reports', 'office.reports', 'file-chart-outline'), items: reportsFor(access, role).map((r) => item(reportHref(r.name), r.title, 'file-document-outline')) }]
          : []),
        ...(office.includes('expenses') ? [item('/office/expenses', 'office.expenses', 'receipt-text-outline')] : []),
        ...(office.includes('team') ? [item('/office/team', 'office.team', 'account-group-outline')] : []),
        ...(office.includes('suppliers') ? [item('/office/suppliers', 'office.suppliers', 'truck-outline')] : []),
        ...(office.includes('customers') ? [item('/office/customers', 'office.customers', 'account-tie-outline')] : []),
        ...(office.includes('products') ? [item('/office/products', 'office.products', 'package-variant-closed')] : []),
      ],
    },
    ...(routeAllowed(access, role, '/approvals') ? [{ key: 'approvals', title: 'appr.title' as TKey, icon: 'check-decagram-outline', href: '/approvals', items: [] }] : []),
    { key: 'notifications', title: 'mazeed.notifications', icon: 'bell-outline', href: '/notifications', items: [] },
    { key: 'sync', title: 'menu.syncProblems', icon: 'sync-alert', href: '/sync-problems', items: [] },
    { key: 'more', title: 'tabs.mazeed', icon: 'dots-horizontal-circle-outline', href: '/mazeed', items: [] },
  ];
  return groups.filter((g) => g.href || g.items.length);
}

/** Every screen under a menu entry (the entry itself, or what it opens to). */
export const linksOf = (i: MenuItem): string[] => (i.items ? i.items.map((x) => x.href) : [i.href]);

/** The part that holds this screen (opened when the menu opens); `href` may carry `?name=` (a report). */
export const groupOf = (groups: MenuGroup[], href: string) => groups.find((g) => g.href === href || g.items.some((i) => linksOf(i).includes(href)))?.key ?? null;
