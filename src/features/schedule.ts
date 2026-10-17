/**
 * Step 13 on the phone: today's milestones (quota left per material — quantities only, never
 * money), site progress updates (MILESTONE_PROGRESS) and stoppage days (STOPPAGE_LOG).
 * The status rules mirror the server (`schedule/progress.service.ts`) so a wrong change is
 * stopped on the phone instead of coming back as a sync problem.
 */
import { listRows } from '../db/store';
import type { Db } from '../db/types';
import { addDays, todayPK } from '../lib/dates';
import { uuidv7 } from '../lib/uuid';
import { enqueue } from '../sync/outbox';
import type { Ctx } from './actions';
import type { MilestoneRow, MilestoneStatus, StoppageReason, StoppageRow } from './types';

const nowOf = (c: Ctx) => c.now ?? new Date();

// ─── Milestones ─────────────────────────────────────────────────────────────

/** Which status may follow which (same table as the server; the current status is always allowed). */
export const MILESTONE_NEXT: Record<MilestoneStatus, MilestoneStatus[]> = {
  PLANNED: ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'CURING', 'DONE'],
  IN_PROGRESS: ['IN_PROGRESS', 'BLOCKED', 'CURING', 'DONE'],
  BLOCKED: ['BLOCKED', 'PLANNED', 'IN_PROGRESS'],
  CURING: ['CURING', 'DONE', 'IN_PROGRESS'],
  DONE: ['DONE'],
};

/** The statuses offered on the update screen (not the current one; CURING only when it has curing days). */
export const statusChoices = (m: Pick<MilestoneRow, 'status' | 'curingDays'>): MilestoneStatus[] => MILESTONE_NEXT[m.status].filter((s) => s !== m.status && (s !== 'CURING' || m.curingDays > 0));

export const milestones = (db: Db, projectId: string) => listRows<MilestoneRow>(db, 'milestones', projectId).sort((a, b) => a.sortOrder - b.sortOrder || a.plannedStart.localeCompare(b.plannedStart));

/** Not finished yet — what usage can be booked against. */
export const openMilestones = (db: Db, projectId: string) => milestones(db, projectId).filter((m) => m.status !== 'DONE');

/** Like the server's "Aaj": the planned window covers the day, or the work is going on / curing / blocked. */
export const todayMilestones = (db: Db, projectId: string, day: string) =>
  milestones(db, projectId).filter((m) => m.status !== 'DONE' && (m.status === 'IN_PROGRESS' || m.status === 'CURING' || m.status === 'BLOCKED' || (m.plannedStart <= day && m.plannedEnd >= day)));

/** Planned end passed and the work is not finished (curing counts as finished). */
export const isLate = (m: Pick<MilestoneRow, 'plannedEnd' | 'status'>, day: string) => m.plannedEnd < day && m.status !== 'DONE' && m.status !== 'CURING';

export interface ProgressInput {
  progressPercent?: number;
  status?: MilestoneStatus;
  note?: string;
  photoIds?: string[];
}

export type ProgressCheck = { status: MilestoneStatus; progressPercent: number; error: 'NOTHING_CHANGED' | 'INVALID_STATUS_CHANGE' | 'NOTE_REQUIRED' | 'VALIDATION_ERROR' | null };

/** What the server will make of the update (status follows the progress like on the server). */
export function checkProgress(m: Pick<MilestoneRow, 'status' | 'progressPercent' | 'curingDays'>, input: ProgressInput): ProgressCheck {
  const from = m.status;
  let progress = input.progressPercent ?? m.progressPercent;
  const fail = (error: ProgressCheck['error']): ProgressCheck => ({ status: from, progressPercent: m.progressPercent, error });
  if (input.progressPercent !== undefined && (!Number.isInteger(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100)) return fail('VALIDATION_ERROR');
  let to: MilestoneStatus = input.status ?? from;
  if (!input.status) {
    if (progress >= 100 && (from === 'PLANNED' || from === 'IN_PROGRESS' || from === 'BLOCKED')) to = m.curingDays > 0 ? 'CURING' : 'DONE';
    else if (progress > 0 && from === 'PLANNED') to = 'IN_PROGRESS';
    else if (progress > 0 && from === 'BLOCKED' && input.progressPercent !== undefined) to = 'IN_PROGRESS';
  }
  if (!MILESTONE_NEXT[from].includes(to)) return fail('INVALID_STATUS_CHANGE');
  if (to === 'BLOCKED' && !input.note?.trim()) return fail('NOTE_REQUIRED');
  if (to === 'CURING' || to === 'DONE') progress = 100;
  if (to === 'PLANNED') progress = 0;
  if (to === 'IN_PROGRESS' && progress >= 100 && input.progressPercent === undefined) progress = 99;
  if (to === from && progress === m.progressPercent && !input.note?.trim() && !input.photoIds?.length) return { status: to, progressPercent: progress, error: 'NOTHING_CHANGED' };
  return { status: to, progressPercent: progress, error: null };
}

/** Site progress (offline): the milestone changes on the phone at once, MILESTONE_PROGRESS goes to the server. */
export function updateMilestone(db: Db, c: Ctx, m: MilestoneRow, input: ProgressInput) {
  const check = checkProgress(m, input);
  if (check.error) throw new Error(check.error);
  const now = nowOf(c);
  const day = todayPK(now);
  const starting = check.status === 'IN_PROGRESS' || check.status === 'CURING' || check.status === 'DONE';
  const finished = check.status === 'CURING' || check.status === 'DONE';
  const row: MilestoneRow = {
    ...m,
    status: check.status,
    progressPercent: check.progressPercent,
    actualStart: starting ? (m.actualStart ?? day) : m.actualStart,
    actualEnd: finished ? (m.status === 'CURING' && m.actualEnd ? m.actualEnd : day) : null,
    curingUntil: check.status === 'CURING' && m.curingDays > 0 ? addDays(day, m.curingDays) : m.curingUntil,
    pendingSync: true,
  };
  const note = input.note?.trim();
  const photos = input.photoIds ?? [];
  return enqueue(
    db,
    {
      type: 'MILESTONE_PROGRESS',
      payload: {
        milestoneId: m.id,
        ...(input.progressPercent !== undefined ? { progressPercent: input.progressPercent } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(note ? { note } : {}),
        date: day,
        ...(photos.length ? { photoAttachmentIds: photos } : {}),
      },
      label: `${m.name} · ${check.progressPercent}%`,
      writes: [{ table: 'milestones', row }],
    },
    now,
  );
}

// ─── Stoppage days ──────────────────────────────────────────────────────────

/** The category the server gives a reason until the office decides. */
export const defaultCategory = (reason: StoppageReason): StoppageRow['category'] =>
  reason === 'OWNER_HOLD' ? 'OWNER' : reason === 'RAIN' || reason === 'SMOG_BAN' || reason === 'HOLIDAY' ? 'EXCUSABLE' : 'CONTRACTOR';

export const stoppageDates = (from: string, days: number) => Array.from({ length: Math.max(0, days) }, (_, i) => addDays(from, i));

export const stoppages = (db: Db, projectId: string) => listRows<StoppageRow>(db, 'stoppages', projectId).sort((a, b) => (b.dates[0] ?? '').localeCompare(a.dates[0] ?? '') || b.reportedAt.localeCompare(a.reportedAt));

export interface StoppageInput {
  projectId: string;
  reason: StoppageReason;
  from: string;
  days: number;
  note?: string;
  photoIds: string[];
}

export type StoppageError = 'VALIDATION_ERROR' | 'DATE_TOO_FAR' | 'PHOTO_REQUIRED' | 'NOTE_REQUIRED' | 'STOPPAGE_OVERLAP';

/** Same rules as the server: 1–31 days, ≤ 60 days ahead, a photo unless HOLIDAY, a note for OTHER, no day logged twice. */
export function checkStoppage(input: Omit<StoppageInput, 'projectId'>, existing: StoppageRow[], today: string): StoppageError | null {
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 31) return 'VALIDATION_ERROR';
  const dates = stoppageDates(input.from, input.days);
  if (dates[dates.length - 1]! > addDays(today, 60)) return 'DATE_TOO_FAR';
  if (input.reason !== 'HOLIDAY' && !input.photoIds.length) return 'PHOTO_REQUIRED';
  if (input.reason === 'OTHER' && !input.note?.trim()) return 'NOTE_REQUIRED';
  const taken = new Set(existing.filter((s) => s.status !== 'REJECTED').flatMap((s) => s.dates));
  if (dates.some((d) => taken.has(d))) return 'STOPPAGE_OVERLAP';
  return null;
}

/** "Kaam ruk gaya" (offline): PENDING until the office approves it. */
export function logStoppage(db: Db, c: Ctx, input: StoppageInput) {
  const now = nowOf(c);
  const error = checkStoppage(input, stoppages(db, input.projectId), todayPK(now));
  if (error) throw new Error(error);
  const clientId = uuidv7(now.getTime());
  const dates = stoppageDates(input.from, input.days);
  const note = input.note?.trim() || null;
  const row: StoppageRow = {
    id: clientId,
    clientId,
    projectId: input.projectId,
    dates,
    reason: input.reason,
    category: defaultCategory(input.reason),
    status: 'PENDING',
    note,
    photoAttachmentIds: input.photoIds,
    reportedById: c.userId,
    reportedAt: now.toISOString(),
    decidedAt: null,
    decisionNote: null,
    pendingSync: true,
  };
  return enqueue(
    db,
    {
      clientId,
      type: 'STOPPAGE_LOG',
      payload: { projectId: input.projectId, dates, reason: input.reason, ...(note ? { note } : {}), ...(input.photoIds.length ? { photoAttachmentIds: input.photoIds } : {}) },
      label: `${dates[0]}${dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ''}`,
      writes: [{ table: 'stoppages', row }],
    },
    now,
  );
}

/** Icon per stoppage reason (an Icon emoji id or MaterialCommunityIcons name). */
export const STOPPAGE_ICON: Record<StoppageReason, string> = { RAIN: '🌧️', SMOG_BAN: 'weather-fog', HOLIDAY: 'calendar-star', OWNER_HOLD: 'account-cancel-outline', MATERIAL_SHORT: '🧱', LABOUR_SHORT: '👷', OTHER: 'dots-horizontal' };
