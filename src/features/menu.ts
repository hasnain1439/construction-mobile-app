/**
 * The side menu (☰): every screen of the app in groups, like the web's sidebar — each item only when
 * the person may open it (the same keys the routes and tabs use), so every role gets its own menu.
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
export interface MenuGroup {
  title: TKey;
  items: MenuItem[];
}

const item = (href: string, label: TKey, icon: string): MenuItem => ({ key: href, label, icon, href });

export function menuFor(access: Access | null | undefined, role: Role | null | undefined): MenuGroup[] {
  const route = (i: MenuItem) => routeAllowed(access, role, i.href);
  const office = officeSections(access, role);
  const groups: MenuGroup[] = [
    {
      title: 'menu.main',
      items: [
        item('/aaj', 'tabs.aaj', 'home-variant-outline'),
        ...(canAny(access, role, TAB_PERMS.hazri) ? [item('/hazri', 'tabs.hazri', 'account-hard-hat-outline')] : []),
        ...(canAny(access, role, TAB_PERMS.maal) ? [item('/maal', 'tabs.maal', 'wall')] : []),
        ...(canAny(access, role, TAB_PERMS.kharcha) ? [item('/kharcha', 'tabs.kharcha', 'wallet-outline')] : []),
        ...(canAny(access, role, OFFICE_TAB_KEYS) ? [item('/office', 'tabs.office', 'briefcase-variant-outline')] : []),
      ],
    },
    {
      title: 'menu.labour',
      items: [
        item('/hazri/worker-new', 'hazri.addWorker', 'account-plus-outline'),
        item('/hazri/peshgi', 'hazri.peshgi', 'hand-coin-outline'),
        item('/hazri/measurement', 'hazri.measurement', 'tape-measure'),
        item('/hazri/settlement', 'hazri.settlement', 'calendar-week'),
      ].filter(route),
    },
    {
      title: 'menu.material',
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
      title: 'menu.cash',
      items: [
        item('/kharcha/new', 'kharcha.add', 'cash-minus'),
        // The owner sends cash; he doesn't ask for it.
        ...(role && rules.requestTopup(access, role) ? [item('/kharcha/topup', 'kharcha.topup', 'cash-plus')] : []),
      ].filter(route),
    },
    {
      title: 'menu.site',
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
      title: 'menu.office',
      items: [
        ...(office.includes('projects') ? [item('/office/projects', 'office.projects', 'office-building-outline')] : []),
        ...(office.includes('reports') ? [item('/office/reports', 'office.reports', 'file-chart-outline')] : []),
        ...(office.includes('team') ? [item('/office/team', 'office.team', 'account-group-outline')] : []),
        ...(office.includes('suppliers') ? [item('/office/suppliers', 'office.suppliers', 'truck-outline')] : []),
        ...(office.includes('customers') ? [item('/office/customers', 'office.customers', 'account-tie-outline')] : []),
        ...(office.includes('products') ? [item('/office/products', 'office.products', 'package-variant-closed')] : []),
      ],
    },
    {
      title: 'menu.other',
      items: [
        ...[item('/approvals', 'appr.title', 'check-decagram-outline')].filter(route),
        item('/notifications', 'mazeed.notifications', 'bell-outline'),
        item('/sync-problems', 'menu.syncProblems', 'sync-alert'),
        item('/mazeed', 'tabs.mazeed', 'dots-horizontal-circle-outline'),
      ],
    },
  ];
  return groups.filter((g) => g.items.length);
}
