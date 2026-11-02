/**
 * The side menu per role: main parts first, each opening to its screens — nothing a role can't use,
 * and never a way to create a project.
 */
import { groupOf, menuFor } from '../src/features/menu';
import type { Access } from '../src/lib/permissions';

const fields = (over: Partial<Access['fieldAccess']> = {}): Access['fieldAccess'] => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
const block = (permissions: string[], fieldAccess = fields()): Access => ({ permissions, fieldAccess, scopes: {}, approvalLimits: {}, permissionRole: null });
type R = 'THEKEDAR' | 'PM' | 'MUNSHI';
const keys = (access: Access | null, role: R) => menuFor(access, role).map((g) => g.key);
const hrefs = (access: Access | null, role: R) => menuFor(access, role).flatMap((g) => [...(g.href ? [g.href] : []), ...g.items.map((i) => i.href)]);

const MUNSHI = block([
  'labor.attendance.create', 'labor.attendance.view', 'masterdata.worker.create', 'labor.advance.create', 'labor.settlement.view',
  'procurement.receiving.create', 'inventory.usage.create', 'cashbook.account.view', 'cashbook.expense.create', 'cashbook.topup.create',
  'dailylog.log.create', 'dailylog.log.view', 'schedule.plan.view', 'masterdata.material.view',
]);

describe('side menu per role', () => {
  it('owner: every main part (with its page and screens), but no top-up request', () => {
    expect(keys(null, 'THEKEDAR')).toEqual(['aaj', 'hazri', 'maal', 'kharcha', 'site', 'office', 'approvals', 'notifications', 'sync', 'more']);
    const all = hrefs(null, 'THEKEDAR');
    for (const h of ['/aaj', '/hazri', '/hazri/settlement', '/maal', '/maal/purchase', '/kharcha', '/site/drawings', '/office', '/office/reports', '/office/team', '/approvals']) expect(all).toContain(h);
    expect(all).not.toContain('/kharcha/topup');
    const office = menuFor(null, 'THEKEDAR').find((g) => g.key === 'office')!;
    expect(office.href).toBe('/office');
    expect(office.items.map((i) => i.href)).toEqual(['/office/projects', '/office/reports', '/office/team', '/office/suppliers', '/office/customers', '/office/products']);
  });

  it('munshi: site work only — no office, no approvals, can ask for a top-up', () => {
    expect(keys(MUNSHI, 'MUNSHI')).not.toContain('office');
    expect(keys(MUNSHI, 'MUNSHI')).not.toContain('approvals');
    const all = hrefs(MUNSHI, 'MUNSHI');
    expect(all).toEqual(expect.arrayContaining(['/hazri/worker-new', '/hazri/peshgi', '/maal/receive', '/maal/usage', '/kharcha/new', '/kharcha/topup', '/log/today', '/site/milestones']));
    expect(all).not.toContain('/maal/purchase');
  });

  it('accountant: the office part with reports, suppliers and customers; no site parts', () => {
    const acc = block(['finance.reports.view', 'masterdata.supplier.view', 'clients.client.view'], fields({ amounts: true }));
    expect(keys(acc, 'PM')).toEqual(['aaj', 'office', 'notifications', 'sync', 'more']);
    expect(hrefs(acc, 'PM')).toEqual(expect.arrayContaining(['/office', '/office/reports', '/office/suppliers', '/office/customers']));
  });

  it('opens the part that holds the current screen', () => {
    const groups = menuFor(null, 'THEKEDAR');
    expect(groupOf(groups, '/maal/usage')).toBe('maal');
    expect(groupOf(groups, '/office')).toBe('office');
    expect(groupOf(groups, '/nowhere')).toBeNull();
  });

  it('never offers project creation', () => {
    for (const h of hrefs(null, 'THEKEDAR')) expect(h).not.toMatch(/projects?\/new|project-create/);
  });
});
