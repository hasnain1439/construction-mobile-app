/**
 * The side menu (☰): the main parts of the app; a part with more screens opens to show them (its own
 * page first), like the web's sidebar. Each entry only when the person may open it (the same keys the
 * routes and tabs use), so every role gets its own menu.
 */
import type { TKey } from '../i18n/en';
import { canAny, routeAllowed, rules, TAB_PERMS, type Access, type Role } from '../lib/permissions';
import { OFFICE_TAB_KEYS, officeSections } from './office';

export interface MenuItem {
  key: string;
  label: TKey;
  icon: string;
  href: string;
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
      items: [
        item('/hazri/worker-new', 'hazri.addWorker', 'account-plus-outline'),
        item('/hazri/peshgi', 'hazri.peshgi', 'hand-coin-outline'),
        item('/hazri/measurement', 'hazri.measurement', 'tape-measure'),
        item('/hazri/settlement', 'hazri.settlement', 'calendar-week'),
      ].filter(route),
    },
    {
      key: 'maal',
      title: 'tabs.maal',
      icon: 'wall',
      href: tab(TAB_PERMS.maal, '/maal'),
      items: [
        item('/maal/receive', 'maal.receive', 'truck-delivery-outline'),
        item('/maal/usage', 'maal.usage', 'wall'),
        item('/maal/owner-delivery', 'maal.ownerDelivery', 'package-variant'),
        item('/maal/purchase', 'maal.purchase', 'cart-outline'),
        item('/maal/count', 'maal.count', 'counter'),
        item('/maal/equipment', 'eq.title', 'crane'),
        item('/maal/equipment-receive', 'eq.receive', 'tray-arrow-down'),
      ].filter(route),
    },
    {
      key: 'kharcha',
      title: 'tabs.kharcha',
      icon: 'wallet-outline',
      href: tab(TAB_PERMS.kharcha, '/kharcha'),
      items: [
        item('/kharcha/new', 'kharcha.add', 'cash-minus'),
        // The owner sends cash; he doesn't ask for it.
        ...(role && rules.requestTopup(access, role) ? [item('/kharcha/topup', 'kharcha.topup', 'cash-plus')] : []),
      ].filter(route),
    },
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
        ...(office.includes('reports') ? [item('/office/reports', 'office.reports', 'file-chart-outline')] : []),
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

/** The part that holds this screen (opened when the menu opens). */
export const groupOf = (groups: MenuGroup[], pathname: string) => groups.find((g) => g.href === pathname || g.items.some((i) => i.href === pathname))?.key ?? null;
