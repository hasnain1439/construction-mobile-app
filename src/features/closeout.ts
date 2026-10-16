/**
 * Steps 15 + 17 on the phone: site instructions (the owner asked for a change — photo + note,
 * SITE_INSTRUCTION_CREATE), snags (before photos → SNAG_CREATE, after photos → SNAG_FIX) and the
 * latest drawing revisions. Nothing here carries money.
 */
import { listRows } from '../db/store';
import type { Db } from '../db/types';
import { todayPK } from '../lib/dates';
import { uuidv7 } from '../lib/uuid';
import { enqueue } from '../sync/outbox';
import { pendingDeps, type Ctx } from './actions';
import { assignments, siteWorkers } from './queries';
import { DRAWING_FOLDERS, type DrawingFolder, type DrawingRow, type SiteInstructionRow, type SnagRow, type SnagStatus } from './types';

const nowOf = (c: Ctx) => c.now ?? new Date();

// ─── Site instructions (Step 15) ────────────────────────────────────────────

/** Newest first. Without `changeorder.instruction.view` only the person's own (the server sends only those anyway). */
export function siteInstructions(db: Db, projectId: string, userId: string, seeAll: boolean): SiteInstructionRow[] {
  return listRows<SiteInstructionRow>(db, 'site_instructions', projectId)
    .filter((s) => seeAll || s.createdById === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const checkInstruction = (note: string): 'NOTE_REQUIRED' | null => (note.trim().length < 3 ? 'NOTE_REQUIRED' : null);

export function recordInstruction(db: Db, c: Ctx, input: { projectId: string; note: string; photoIds: string[] }) {
  const err = checkInstruction(input.note);
  if (err) throw new Error(err);
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const note = input.note.trim();
  const row: SiteInstructionRow = {
    id: clientId,
    clientId,
    projectId: input.projectId,
    number: null,
    code: null,
    note,
    photoIds: input.photoIds,
    status: 'NEW',
    changeOrderId: null,
    changeOrderCode: null,
    dismissReason: null,
    createdById: c.userId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    pendingSync: true,
  };
  return enqueue(
    db,
    {
      clientId,
      type: 'SITE_INSTRUCTION_CREATE',
      payload: { projectId: input.projectId, note, ...(input.photoIds.length ? { photoIds: input.photoIds } : {}) },
      label: note.slice(0, 60),
      writes: [{ table: 'site_instructions', row }],
    },
    now,
  );
}

// ─── Snags (Step 17) ────────────────────────────────────────────────────────

const ORDER: Record<SnagStatus, number> = { OPEN: 0, FIXED: 1, VERIFIED: 2 };

/** Open first, then fixed, then verified; newest first inside each. */
export function snags(db: Db, projectId: string, status?: SnagStatus | null): SnagRow[] {
  return listRows<SnagRow>(db, 'snags', projectId)
    .filter((s) => !status || s.status === status)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.number ?? Number.MAX_SAFE_INTEGER) - (a.number ?? Number.MAX_SAFE_INTEGER) || b.updatedAt.localeCompare(a.updatedAt));
}

export const isOverdue = (s: Pick<SnagRow, 'status' | 'targetDate'>, today: string) => s.status === 'OPEN' && !!s.targetDate && s.targetDate < today;

export type Assignee = { type: 'WORKER' | 'SUBCONTRACTOR'; id: string; name: string };

/** Who a snag can be given to: the site's workers and sub-contractors. */
export function assigneeOptions(db: Db, projectId: string): Assignee[] {
  const subs = new Map<string, Assignee>();
  for (const a of assignments(db, projectId)) subs.set(a.subcontractor.id, { type: 'SUBCONTRACTOR', id: a.subcontractor.id, name: a.subcontractor.name });
  return [...siteWorkers(db, projectId).map(({ worker }) => ({ type: 'WORKER' as const, id: worker.id, name: worker.name })), ...[...subs.values()].sort((a, b) => a.name.localeCompare(b.name))];
}

export function assigneeName(db: Db, s: Pick<SnagRow, 'projectId' | 'workerId' | 'subcontractorId'>): string | null {
  const id = s.workerId ?? s.subcontractorId;
  return id ? (assigneeOptions(db, s.projectId).find((a) => a.id === id)?.name ?? null) : null;
}

export interface SnagInput {
  projectId: string;
  location: string;
  description: string;
  beforePhotoIds: string[];
  targetDate?: string | null;
  assignee?: Assignee | null;
}

export type SnagError = 'LOCATION_REQUIRED' | 'DESCRIPTION_REQUIRED' | 'PHOTO_REQUIRED';

/** Where (room / place), what (3+ letters) and at least one "before" photo. */
export function checkSnag(input: Pick<SnagInput, 'location' | 'description' | 'beforePhotoIds'>): SnagError | null {
  if (!input.location.trim()) return 'LOCATION_REQUIRED';
  if (input.description.trim().length < 3) return 'DESCRIPTION_REQUIRED';
  if (!input.beforePhotoIds.length) return 'PHOTO_REQUIRED';
  return null;
}

export function createSnag(db: Db, c: Ctx, input: SnagInput) {
  const err = checkSnag(input);
  if (err) throw new Error(err);
  const now = nowOf(c);
  const clientId = uuidv7(now.getTime());
  const location = input.location.trim();
  const description = input.description.trim();
  const a = input.assignee ?? null;
  const row: SnagRow = {
    id: clientId,
    clientId,
    projectId: input.projectId,
    number: null,
    code: null,
    roomId: null,
    location,
    description,
    status: 'OPEN',
    targetDate: input.targetDate ?? null,
    inDefectPeriod: false,
    assigneeType: a?.type ?? null,
    workerId: a?.type === 'WORKER' ? a.id : null,
    subcontractorId: a?.type === 'SUBCONTRACTOR' ? a.id : null,
    beforePhotoIds: input.beforePhotoIds,
    afterPhotoIds: [],
    fixNote: null,
    fixedAt: null,
    verifiedAt: null,
    createdById: c.userId,
    updatedAt: now.toISOString(),
    pendingSync: true,
  };
  return enqueue(
    db,
    {
      clientId,
      type: 'SNAG_CREATE',
      payload: {
        projectId: input.projectId,
        location,
        description,
        beforePhotoIds: input.beforePhotoIds,
        ...(input.targetDate ? { targetDate: input.targetDate } : {}),
        ...(a?.type === 'WORKER' ? { workerId: a.id } : a?.type === 'SUBCONTRACTOR' ? { subcontractorId: a.id } : {}),
      },
      label: `${location} · ${description}`.slice(0, 60),
      dependsOn: pendingDeps(db, [a?.type === 'WORKER' ? a.id : null]),
      writes: [{ table: 'snags', row }],
    },
    now,
  );
}

export const checkFix = (s: Pick<SnagRow, 'status'>, afterPhotoIds: string[]): 'INVALID_SNAG_STATUS' | 'PHOTO_REQUIRED' | null =>
  s.status !== 'OPEN' ? 'INVALID_SNAG_STATUS' : !afterPhotoIds.length ? 'PHOTO_REQUIRED' : null;

/** "Theek ho gaya": after photos; the office verifies it. A snag made on this phone waits for its SNAG_CREATE. */
export function fixSnag(db: Db, c: Ctx, s: SnagRow, input: { afterPhotoIds: string[]; note?: string }) {
  const err = checkFix(s, input.afterPhotoIds);
  if (err) throw new Error(err);
  const now = nowOf(c);
  const note = input.note?.trim() || null;
  return enqueue(
    db,
    {
      type: 'SNAG_FIX',
      payload: { snagId: s.id, afterPhotoIds: input.afterPhotoIds, ...(note ? { note } : {}) },
      label: `${s.code ?? s.location ?? ''} · ${s.description}`.slice(0, 60),
      dependsOn: pendingDeps(db, [s.id]),
      writes: [{ table: 'snags', row: { ...s, status: 'FIXED', afterPhotoIds: input.afterPhotoIds, fixNote: note, fixedAt: now.toISOString(), updatedAt: now.toISOString(), pendingSync: true } }],
    },
    now,
  );
}

/** Target date choices: none, or in 3 / 7 / 14 days. */
export const targetIn = (days: number, now = new Date()) => {
  const d = new Date(`${todayPK(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// ─── Drawings (Step 17) ─────────────────────────────────────────────────────

/** Latest revisions grouped by folder (folder order as on the web), titles A→Z. */
export function drawingsByFolder(db: Db, projectId: string): { folder: DrawingFolder; items: DrawingRow[] }[] {
  const all = listRows<DrawingRow>(db, 'drawings', projectId);
  return DRAWING_FOLDERS.map((folder) => ({ folder, items: all.filter((d) => d.folder === folder).sort((a, b) => (a.number ?? a.title).localeCompare(b.number ?? b.title)) })).filter((g) => g.items.length);
}
