import { ApiError, request } from '../src/api/client';
import { readAccess, saveAccess } from '../src/db/access';
import { wipeAll } from '../src/db/kv';
import { errorText, rejectedText, translate } from '../src/i18n';
import { accessFrom, can, canAny, LEGACY_KEYS, PERM, routeAllowed, rules, seesField, TAB_PERMS, type Access } from '../src/lib/permissions';
import { enqueue, problems } from '../src/sync/outbox';
import { pullAll } from '../src/sync/pull';
import { pushOutbox } from '../src/sync/push';
import { testDb } from './helpers/db';
import { FakeApi } from './helpers/fakeApi';

jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));

/** The default MUNSHI template (PERMISSIONS_API.md §6), as /auth/me sends it. */
const munshi: Access = {
  permissions: [
    'cashbook.account.view',
    'cashbook.count.create',
    'cashbook.expense.create',
    'cashbook.expense.view',
    'cashbook.handover.create',
    'cashbook.topup.create',
    'cashbook.topup.view',
    'dailylog.log.create',
    'dailylog.log.view',
    'inventory.count.create',
    'inventory.ownerdelivery.create',
    'inventory.stock.view',
    'inventory.usage.create',
    'labor.advance.create',
    'labor.attendance.create',
    'labor.attendance.view',
    'labor.settlement.create',
    'labor.settlement.view',
    'labor.wagepayment.create',
    'masterdata.worker.create',
    'procurement.dispatch.view',
    'procurement.purchase.create',
    'procurement.receiving.create',
    'projects.project.view',
  ],
  legacyPermissions: ['site.entry'],
  fieldAccess: { rates: false, amounts: false, profit: false, contract: false },
  scopes: { 'projects.project.view': 'ASSIGNED_PROJECTS' },
  approvalLimits: {},
  permissionRole: { id: 'r1', key: 'MUNSHI', name: 'Munshi' },
};

/** A store keeper: material only, no labour, no cash. */
const storeKeeper: Access = {
  ...munshi,
  permissions: ['procurement.dispatch.view', 'procurement.receiving.create', 'inventory.usage.create', 'inventory.stock.view', 'dailylog.log.create'],
  permissionRole: { id: 'r2', key: 'STORE_KEEPER', name: 'Store Keeper' },
};

describe('can()', () => {
  it('follows the keys from /auth/me', () => {
    expect(can(munshi, 'MUNSHI', PERM.hazriMark)).toBe(true);
    expect(can(munshi, 'MUNSHI', 'labor.settlement.approve')).toBe(false);
    expect(can(storeKeeper, 'MUNSHI', PERM.hazriMark)).toBe(false);
    expect(can(storeKeeper, 'MUNSHI', PERM.receive)).toBe(true);
  });

  it('a DENY override (key missing) hides the action even for a PM', () => {
    const pm: Access = { ...munshi, permissions: munshi.permissions.filter((k) => k !== PERM.peshgiCreate), fieldAccess: { rates: true, amounts: false, profit: false, contract: false } };
    expect(can(pm, 'PM', PERM.peshgiCreate)).toBe(false);
    expect(can(pm, 'PM', PERM.hazriMark)).toBe(true);
  });

  it('THEKEDAR may do everything, whatever the block says', () => {
    expect(can(storeKeeper, 'THEKEDAR', 'labor.settlement.approve')).toBe(true);
    expect(can(null, 'THEKEDAR', 'fields.profit')).toBe(true);
  });

  it('old legacy names keep working through the new keys', () => {
    expect(LEGACY_KEYS['rates.view']).toBe('fields.rates');
    expect(can(munshi, 'MUNSHI', 'site.entry')).toBe(true);
    expect(can(storeKeeper, 'MUNSHI', 'site.entry')).toBe(false);
    expect(can(munshi, 'MUNSHI', 'rates.view')).toBe(false);
    expect(can({ ...munshi, fieldAccess: { ...munshi.fieldAccess, rates: true } }, 'MUNSHI', 'rates.view')).toBe(true);
  });

  it('field visibility comes from fieldAccess', () => {
    expect(seesField(munshi, 'MUNSHI', 'rates')).toBe(false);
    const accountant: Access = { ...munshi, fieldAccess: { rates: true, amounts: true, profit: false, contract: true } };
    expect(seesField(accountant, 'PM', 'amounts')).toBe(true);
    expect(seesField(accountant, 'PM', 'profit')).toBe(false);
  });

  it('without a stored block (older build, before the first pull) keeps the old behaviour', () => {
    expect(can(null, 'MUNSHI', PERM.peshgiCreate)).toBe(true);
    expect(can(null, 'MUNSHI', 'fields.rates')).toBe(false);
    expect(can(null, 'PM', 'fields.rates')).toBe(true);
    expect(can(null, 'PM', 'fields.amounts')).toBe(false);
  });

  it('canAny, tabs and the account-type rules', () => {
    expect(canAny(storeKeeper, 'MUNSHI', TAB_PERMS.hazri)).toBe(false);
    expect(canAny(storeKeeper, 'MUNSHI', TAB_PERMS.maal)).toBe(true);
    expect(canAny(storeKeeper, 'MUNSHI', TAB_PERMS.kharcha)).toBe(false);
    expect(rules.requestTopup(munshi, 'MUNSHI')).toBe(true);
    expect(rules.requestTopup(munshi, 'THEKEDAR')).toBe(false);
    expect(rules.requestTopup(storeKeeper, 'MUNSHI')).toBe(false);
    expect(rules.setWorkerRate(munshi, 'MUNSHI')).toBe(false);
    expect(rules.setWorkerRate(null, 'PM')).toBe(true);
    expect(rules.payWages(storeKeeper, 'PM')).toBe(false);
  });

  it('guards the stack screens', () => {
    expect(routeAllowed(storeKeeper, 'MUNSHI', '/hazri/peshgi')).toBe(false);
    expect(routeAllowed(storeKeeper, 'MUNSHI', '/maal/receive')).toBe(true);
    expect(routeAllowed(storeKeeper, 'MUNSHI', '/kharcha/topup/')).toBe(false);
    expect(routeAllowed(storeKeeper, 'MUNSHI', '/sync-problems')).toBe(true);
  });

  it('accessFrom reads a login / me / pull answer and ignores an old one without the block', () => {
    expect(accessFrom({ user: {}, permissions: ['a.b.view'], fieldAccess: { rates: true } })).toMatchObject({ permissions: ['a.b.view'], fieldAccess: { rates: true, amounts: false } });
    expect(accessFrom({ user: {}, permissions: ['rates.view'] })).toBeNull();
    expect(accessFrom(null)).toBeNull();
  });
});

describe('stored access (offline)', () => {
  it('is saved, read back and wiped on logout', () => {
    const db = testDb();
    expect(readAccess(db)).toBeNull();
    saveAccess(db, { user: { id: 'u1' }, ...munshi });
    expect(readAccess(db)?.permissions).toContain(PERM.hazriMark);
    saveAccess(db, { user: { id: 'u1' } }); // an old server: keep the last block
    expect(readAccess(db)?.permissionRole?.key).toBe('MUNSHI');
    wipeAll(db);
    expect(readAccess(db)).toBeNull();
  });

  it('every sync pull replaces it with the server block', async () => {
    const db = testDb();
    saveAccess(db, munshi);
    const api = new FakeApi().page({}, { access: storeKeeper });
    await pullAll(db, api);
    expect(readAccess(db)?.permissionRole?.key).toBe('STORE_KEEPER');
    expect(can(readAccess(db), 'MUNSHI', PERM.hazriMark)).toBe(false);
  });

  it('a reset pull (permissions changed) also brings the new block', async () => {
    const db = testDb();
    saveAccess(db, munshi);
    const api = new FakeApi().page({}, { resetRequired: true, access: storeKeeper }).page({}, { access: storeKeeper });
    await pullAll(db, api);
    expect(readAccess(db)?.permissionRole?.key).toBe('STORE_KEEPER');
  });
});

describe('PERMISSION_DENIED message', () => {
  it('is "Aap ko is ki ijazat nahi" in every language', () => {
    expect(errorText('roman', 'PERMISSION_DENIED')).toBe('Aap ko is ki ijazat nahi');
    expect(errorText('en', 'PERMISSION_DENIED')).toBe('You don’t have permission for this');
    expect(errorText('ur', 'PERMISSION_DENIED')).toBe('آپ کو اس کی اجازت نہیں');
    expect(errorText('roman', 'APPROVAL_LIMIT_EXCEEDED')).toBe('Ye raqam aap ki manzoori ki had se zyada hai');
    expect(translate('ur', 'err.APPROVAL_LIMIT_EXCEEDED')).toBe('یہ رقم آپ کی منظوری کی حد سے زیادہ ہے');
  });

  it('a REST 403 PERMISSION_DENIED becomes the message', async () => {
    const denied = (async () =>
      new Response(JSON.stringify({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Missing labor.advance.create', details: { permission: 'labor.advance.create' } } }), { status: 403 })) as unknown as typeof fetch;
    const err = await request('/projects/p1/advances', { method: 'POST', auth: false, fetchImpl: denied }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'PERMISSION_DENIED', details: { permission: 'labor.advance.create' } });
    expect(errorText('roman', (err as ApiError).code)).toBe('Aap ko is ki ijazat nahi');
  });

  it('a REJECTED sync entry is rolled back, not retried, and shows the message under Sync problems', async () => {
    const db = testDb();
    enqueue(db, {
      clientId: 'adv1',
      type: 'ADVANCE_CREATE',
      payload: { clientId: 'adv1', amountPaisa: '50000' },
      label: 'Peshgi Rs 500',
      writes: [{ table: 'advances', row: { id: 'adv1', clientId: 'adv1', amountPaisa: '50000' } }],
    });
    const api = new FakeApi();
    api.decide = () => ({ status: 'REJECTED', error: { code: 'PERMISSION_DENIED', message: 'x', details: { permission: 'labor.advance.create' } } });
    const res = await pushOutbox(db, api);
    expect(res).toMatchObject({ rejected: 1, retry: 0 });
    const [problem] = problems(db);
    expect(problem!.label).toBe('Peshgi Rs 500');
    expect(rejectedText('roman', problem!.lastError)).toBe('Aap ko is ki ijazat nahi');
    expect(rejectedText('ur', problem!.lastError)).toBe('آپ کو اس کی اجازت نہیں');
    expect(rejectedText('en', 'not json')).toBe(translate('en', 'err.generic'));
  });
});
