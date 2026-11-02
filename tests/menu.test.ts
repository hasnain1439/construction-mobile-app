/**
 * The side menu per role: every screen the person may open, grouped like the web's sidebar —
 * nothing a role can't use, and never a way to create a project.
 */
import { menuFor } from '../src/features/menu';
import type { Access } from '../src/lib/permissions';

const fields = (over: Partial<Access['fieldAccess']> = {}): Access['fieldAccess'] => ({ rates: false, amounts: false, profit: false, contract: false, wages: true, ...over });
const block = (permissions: string[], fieldAccess = fields()): Access => ({ permissions, fieldAccess, scopes: {}, approvalLimits: {}, permissionRole: null });
const hrefs = (access: Access | null, role: 'THEKEDAR' | 'PM' | 'MUNSHI') => menuFor(access, role).flatMap((g) => g.items.map((i) => i.href));
const titles = (access: Access | null, role: 'THEKEDAR' | 'PM' | 'MUNSHI') => menuFor(access, role).map((g) => g.title);

const MUNSHI = block([
  'labor.attendance.create', 'labor.attendance.view', 'masterdata.worker.create', 'labor.advance.create', 'labor.settlement.view',
  'procurement.receiving.create', 'inventory.usage.create', 'cashbook.account.view', 'cashbook.expense.create', 'cashbook.topup.create',
  'dailylog.log.create', 'dailylog.log.view', 'schedule.plan.view', 'masterdata.material.view',
]);

describe('side menu per role', () => {
  it('owner: every group and screen, but no top-up request (the owner sends cash)', () => {
    const all = hrefs(null, 'THEKEDAR');
    expect(titles(null, 'THEKEDAR')).toEqual(['menu.main', 'menu.labour', 'menu.material', 'menu.cash', 'menu.site', 'menu.office', 'menu.other']);
    for (const h of ['/aaj', '/hazri', '/maal', '/kharcha', '/office', '/hazri/settlement', '/maal/purchase', '/site/drawings', '/office/reports', '/office/team', '/approvals', '/notifications']) expect(all).toContain(h);
    expect(all).not.toContain('/kharcha/topup');
  });

  it('munshi: site work only — no office group, no approvals, can ask for a top-up', () => {
    const all = hrefs(MUNSHI, 'MUNSHI');
    expect(titles(MUNSHI, 'MUNSHI')).not.toContain('menu.office');
    expect(all).toEqual(expect.arrayContaining(['/hazri/worker-new', '/hazri/peshgi', '/maal/receive', '/maal/usage', '/kharcha/new', '/kharcha/topup', '/log/today', '/site/milestones']));
    expect(all).not.toContain('/approvals');
    expect(all).not.toContain('/office');
    expect(all).not.toContain('/maal/purchase');
  });

  it('accountant: reports, suppliers and customers in the office group; no site groups', () => {
    const acc = block(['finance.reports.view', 'masterdata.supplier.view', 'clients.client.view'], fields({ amounts: true }));
    expect(titles(acc, 'PM')).toEqual(['menu.main', 'menu.office', 'menu.other']);
    expect(hrefs(acc, 'PM')).toEqual(expect.arrayContaining(['/office', '/office/reports', '/office/suppliers', '/office/customers']));
  });

  it('never offers project creation', () => {
    for (const h of hrefs(null, 'THEKEDAR')) expect(h).not.toMatch(/projects?\/new|project-create/);
  });
});
