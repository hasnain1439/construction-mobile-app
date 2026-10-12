import { getRow, putRow } from '../../src/db/store';
import { addWorker } from '../../src/features/actions';
import type { WorkerTypeRow } from '../../src/features/types';
import { workerTypeMap, workerTypeName, workerTypeOptions, workerTypes } from '../../src/features/workerTypes';
import { pendingItems } from '../../src/sync/outbox';
import { testDb } from '../helpers/db';

const type = (key: string, label: string, labelRoman: string | null, labelUrdu: string | null, ratePaisa: string, isActive = true): WorkerTypeRow => ({
  id: `wt-${key}`,
  key,
  label,
  labelRoman,
  labelUrdu,
  ratePaisa,
  overtimeMultiplier: null,
  isActive,
  updatedAt: '2026-10-01T09:00:00.000Z',
});

const ROWS = [
  type('MISTRI', 'Mason', 'Mistri', 'مستری', '280000'),
  type('MAZDOOR', 'Labourer', 'Mazdoor', null, '180000'),
  type('ELECTRICIAN', 'Electrician', null, null, '300000'),
  type('CHOWKIDAR', 'Watchman', 'Chowkidar', 'چوکیدار', '150000', false),
];

describe('worker types', () => {
  it('offers the active company types sorted by name in the chosen language, then Other', () => {
    expect(workerTypeOptions(ROWS, 'en').map((o) => o.name)).toEqual(['Electrician', 'Labourer', 'Mason', 'Other']);
    expect(workerTypeOptions(ROWS, 'roman').map((o) => o.name)).toEqual(['Electrician', 'Mazdoor', 'Mistri', 'Deegar']);
    const ur = workerTypeOptions(ROWS, 'ur');
    expect(ur.map((o) => [o.key, o.name])).toEqual(expect.arrayContaining([['MISTRI', 'مستری'], ['MAZDOOR', 'Mazdoor'], ['ELECTRICIAN', 'Electrician']]));
    expect(ur.at(-1)).toEqual({ key: 'OTHER', name: 'دیگر', ratePaisa: null });
    expect(ur.find((o) => o.key === 'CHOWKIDAR')).toBeUndefined();
    expect(workerTypeOptions(ROWS, 'en').find((o) => o.key === 'MISTRI')!.ratePaisa).toBe('280000');
  });

  it('falls back to a small built-in list before the first sync', () => {
    expect(workerTypeOptions([], 'roman').map((o) => o.key)).toEqual(['MAZDOOR', 'MISTRI', 'OTHER']);
  });

  it('names a worker’s type from the table (inactive too), then the worker’s own labels', () => {
    const db = testDb();
    for (const r of ROWS) putRow(db, 'worker_types', r);
    const map = workerTypeMap(db);
    expect(workerTypes(db)).toHaveLength(4);
    expect(workerTypeName({ type: 'CHOWKIDAR' }, map, 'ur')).toBe('چوکیدار');
    expect(workerTypeName({ type: 'MAZDOOR' }, map, 'en')).toBe('Labourer');
    expect(workerTypeName({ type: 'PLUMBER', typeLabel: 'Plumber', typeLabelRoman: 'Plumber', typeLabelUrdu: 'پلمبر' }, map, 'ur')).toBe('پلمبر');
    expect(workerTypeName({ type: 'OTHER' }, map, 'roman')).toBe('Deegar');
  });

  it('WORKER_CREATE sends the type key; the optimistic worker carries the type’s labels and rate', () => {
    const db = testDb();
    for (const r of ROWS) putRow(db, 'worker_types', r);
    const ctx = { userId: 'u', userName: 'U', now: new Date('2026-10-06T09:00:00+05:00') };
    const id = addWorker(db, ctx, { projectId: 'p', name: 'Bashir', type: 'ELECTRICIAN' });
    expect(JSON.parse(pendingItems(db)[0]!.payload)).toEqual({ name: 'Bashir', type: 'ELECTRICIAN' });
    expect(getRow(db, 'workers', id)).toMatchObject({ type: 'ELECTRICIAN', typeLabel: 'Electrician', dailyRatePaisa: '300000' });
  });
});
