/**
 * Company-defined worker types (synced `worker_types`) and their names in the munshi's language.
 * A worker's `type` is a worker_types `key`, or 'OTHER'.
 */
import { listRows } from '../db/store';
import type { Db } from '../db/types';
import type { Language } from '../i18n';
import type { WorkerRow, WorkerTypeRow } from './types';

export const OTHER_TYPE = 'OTHER';

type Labels = { label: string; labelRoman: string | null; labelUrdu: string | null };

const OTHER_LABELS: Labels = { label: 'Other', labelRoman: 'Deegar', labelUrdu: 'دیگر' };

/** Used only until the first sync brings the company's own list (the screen must work offline). */
export const BUILTIN_WORKER_TYPES: (Labels & { key: string; ratePaisa: string | null })[] = [
  { key: 'MISTRI', label: 'Mason', labelRoman: 'Mistri', labelUrdu: 'مستری', ratePaisa: null },
  { key: 'MAZDOOR', label: 'Labourer', labelRoman: 'Mazdoor', labelUrdu: 'مزدور', ratePaisa: null },
];

/** ur → Urdu, else Roman, else English · roman → Roman, else English · en → English. */
export function labelIn(language: Language, l: Labels): string {
  if (language === 'ur') return l.labelUrdu || l.labelRoman || l.label;
  if (language === 'roman') return l.labelRoman || l.label;
  return l.label;
}

export type WorkerTypeOption = { key: string; name: string; ratePaisa: string | null };

/** Choices for a new worker: active company types by name, then "Other". */
export function workerTypeOptions(rows: WorkerTypeRow[], language: Language): WorkerTypeOption[] {
  const source = rows.length ? rows.filter((r) => r.isActive && r.key !== OTHER_TYPE) : BUILTIN_WORKER_TYPES;
  const options = source.map((r) => ({ key: r.key, name: labelIn(language, r), ratePaisa: r.ratePaisa ?? null })).sort((a, b) => a.name.localeCompare(b.name));
  return [...options, { key: OTHER_TYPE, name: labelIn(language, OTHER_LABELS), ratePaisa: null }];
}

export const workerTypes = (db: Db) => listRows<WorkerTypeRow>(db, 'worker_types');

/** key → type (active and inactive: a worker may keep a deactivated type). */
export const workerTypeMap = (db: Db) => new Map(workerTypes(db).map((r) => [r.key, r]));

/** The worker's type in the current language: synced type › labels on the worker › built-in › the key. */
export function workerTypeName(worker: Pick<WorkerRow, 'type' | 'typeLabel' | 'typeLabelRoman' | 'typeLabelUrdu'>, types: Map<string, WorkerTypeRow>, language: Language): string {
  const synced = types.get(worker.type);
  if (synced) return labelIn(language, synced);
  if (worker.typeLabel) return labelIn(language, { label: worker.typeLabel, labelRoman: worker.typeLabelRoman ?? null, labelUrdu: worker.typeLabelUrdu ?? null });
  if (worker.type === OTHER_TYPE) return labelIn(language, OTHER_LABELS);
  const builtin = BUILTIN_WORKER_TYPES.find((b) => b.key === worker.type);
  if (builtin) return labelIn(language, builtin);
  return worker.type ? worker.type.charAt(0) + worker.type.slice(1).toLowerCase().replace(/_/g, ' ') : '';
}
