/**
 * One sync run = (1) upload queued photos / voice notes, (2) push the outbox, (3) pull until
 * `hasMore` is false. Only one run at a time: a second caller waits for the running one.
 * Screens subscribe to `SyncStatus` (the banner, the "Sync problems" list).
 */
import { inArray, sql } from 'drizzle-orm';
import { NetworkError } from '../api/client';
import { outbox } from '../db/schema';
import type { Db } from '../db/types';
import type { SyncApi } from './api';
import { pendingAttachments, uploadPending } from './attachments';
import { pendingCount, problems } from './outbox';
import { getSyncState, pullAll, setSyncState } from './pull';
import { pushOutbox } from './push';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  pendingUploads: number;
  problems: number;
  lastPullAt: number | null;
  lastError: string | null;
}

type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();
let current: SyncStatus = { phase: 'idle', pending: 0, pendingUploads: 0, problems: 0, lastPullAt: null, lastError: null };
let running: Promise<SyncStatus> | null = null;

export const getStatus = () => current;
export function subscribe(l: Listener) {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}

function emit(db: Db, patch: Partial<SyncStatus>) {
  const st = getSyncState(db);
  current = {
    ...current,
    pending: pendingCount(db),
    pendingUploads: pendingAttachments(db),
    problems: problems(db).length,
    lastPullAt: st.lastPullAt ?? null,
    ...patch,
  };
  listeners.forEach((l) => l(current));
}

/** Refresh the counters after a local write (enqueue) without syncing. */
export const refreshStatus = (db: Db) => emit(db, {});

/** An app killed mid-push leaves items SENDING; they were never confirmed, so send them again. */
export function recoverInterrupted(db: Db) {
  db.update(outbox)
    .set({ status: 'PENDING' })
    .where(inArray(outbox.status, ['SENDING']))
    .run();
}

/** Drops confirmed outbox rows older than a week (kept a while for debugging). */
export function pruneApplied(db: Db, now = Date.now()) {
  db.run(sql`DELETE FROM outbox WHERE status = 'APPLIED' AND created_at < ${now - 7 * 86_400_000}`);
}

export interface SyncOptions {
  deviceId?: string;
  /** Skip the pull (logout: only send what is waiting). */
  pushOnly?: boolean;
  now?: () => number;
}

async function run(db: Db, api: SyncApi, opts: SyncOptions): Promise<SyncStatus> {
  const now = opts.now ?? Date.now;
  recoverInterrupted(db);
  emit(db, { phase: 'syncing' });
  try {
    await uploadPending(db, api);
    await pushOutbox(db, api, { now: now(), deviceId: opts.deviceId });
    setSyncState(db, { lastPushAt: now() });
    if (!opts.pushOnly) await pullAll(db, api, now());
    pruneApplied(db, now());
    setSyncState(db, { lastError: null });
    emit(db, { phase: 'idle', lastError: null });
  } catch (err) {
    const offline = err instanceof NetworkError;
    const message = err instanceof Error ? err.message : String(err);
    setSyncState(db, { lastError: message });
    emit(db, { phase: offline ? 'offline' : 'error', lastError: message });
  }
  return current;
}

export function syncNow(db: Db, api: SyncApi, opts: SyncOptions = {}): Promise<SyncStatus> {
  running ??= run(db, api, opts).finally(() => {
    running = null;
  });
  return running;
}

/** Test helper. */
export function resetEngineForTests() {
  running = null;
  listeners.clear();
  current = { phase: 'idle', pending: 0, pendingUploads: 0, problems: 0, lastPullAt: null, lastError: null };
}
