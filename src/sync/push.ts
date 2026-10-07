/**
 * Sends the outbox in order (≤ 100 per call). Only the ready PREFIX is sent: an item waiting
 * for its back-off stops everything after it, so the server always sees creation order.
 *   APPLIED / DUPLICATE → done; a row created on the phone takes the server's id
 *   REJECTED            → the optimistic change is rolled back; kept for "Sync problems"
 *   RETRY / no network  → back off (15 s, 30 s, 1 min … max 30 min) and try later
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { NetworkError } from '../api/client';
import { outbox } from '../db/schema';
import { renameRow } from '../db/store';
import type { Db } from '../db/types';
import type { PushMutation, SyncApi } from './api';
import { pendingCount, rollback, type LocalChange, type OutboxItem } from './outbox';

export const BATCH = 100;
export const backoffMs = (attempts: number) => Math.min(30 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1));

function readyPrefix(db: Db, now: number): OutboxItem[] {
  const items = db.select().from(outbox).where(eq(outbox.status, 'PENDING')).orderBy(asc(outbox.seq)).limit(BATCH).all();
  const out: OutboxItem[] = [];
  for (const i of items) {
    if (i.nextAttemptAt > now) break;
    out.push(i);
  }
  return out;
}

const toMutation = (i: OutboxItem): PushMutation => {
  const dependsOn = JSON.parse(i.dependsOn) as string[];
  return { clientId: i.clientId, type: i.type, payload: JSON.parse(i.payload) as Record<string, unknown>, deviceCreatedAt: i.deviceCreatedAt, ...(dependsOn.length ? { dependsOn } : {}) };
};

export interface PushSummary {
  sent: number;
  applied: number;
  rejected: number;
  retry: number;
}

export async function pushOutbox(db: Db, api: SyncApi, opts: { now?: number; deviceId?: string } = {}): Promise<PushSummary> {
  const now = opts.now ?? Date.now();
  const summary: PushSummary = { sent: 0, applied: 0, rejected: 0, retry: 0 };
  for (;;) {
    const batch = readyPrefix(db, now);
    if (!batch.length) break;
    const ids = batch.map((b) => b.clientId);
    db.update(outbox).set({ status: 'SENDING' }).where(inArray(outbox.clientId, ids)).run();
    let results;
    try {
      results = (await api.push(batch.map(toMutation), pendingCount(db), opts.deviceId)).results;
    } catch (err) {
      // Nothing was confirmed: everything goes back to PENDING with a back-off.
      for (const b of batch) db.update(outbox).set({ status: 'PENDING', attempts: b.attempts + 1, nextAttemptAt: now + backoffMs(b.attempts + 1) }).where(eq(outbox.clientId, b.clientId)).run();
      throw err instanceof NetworkError ? err : new NetworkError(String(err));
    }
    summary.sent += batch.length;
    let stop = false;
    db.transaction((tx) => {
      const t = tx as unknown as Db;
      for (const item of batch) {
        const r = results.find((x) => x.clientId === item.clientId);
        if (!r || r.status === 'RETRY') {
          summary.retry += 1;
          stop = true;
          t.update(outbox)
            .set({ status: 'PENDING', attempts: item.attempts + 1, nextAttemptAt: now + backoffMs(item.attempts + 1), lastError: r?.error ? JSON.stringify(r.error) : null })
            .where(eq(outbox.clientId, item.clientId))
            .run();
        } else if (r.status === 'REJECTED') {
          summary.rejected += 1;
          rollback(t, item);
          t.update(outbox).set({ status: 'REJECTED', lastError: JSON.stringify(r.error) }).where(eq(outbox.clientId, item.clientId)).run();
        } else {
          summary.applied += 1;
          if (r.serverId) {
            // A row this mutation created on the phone (id = clientId) now carries the server id.
            for (const c of JSON.parse(item.localChanges) as LocalChange[]) if (!c.before && c.id === item.clientId) renameRow(t, c.table, c.id, r.serverId);
          }
          t.update(outbox).set({ status: 'APPLIED', serverId: r.serverId, lastError: null }).where(eq(outbox.clientId, item.clientId)).run();
        }
      }
    });
    if (stop) break;
  }
  return summary;
}
