/**
 * Pulls until `hasMore` is false and applies each page in ONE SQLite transaction:
 * upserts replace rows, deletes are tombstones; a snapshot (no cursor) replaces whole tables.
 * Rows still waiting in the outbox are left alone (the push decides them); optimistic copies
 * (same clientId, or for hazri the same worker + day) are dropped when the server row arrives.
 * `resetRequired` → wipe the mirrored tables and pull a fresh snapshot.
 */
import { and, eq, ne, notInArray } from 'drizzle-orm';
import { SYNC_TABLES, SYNC_TABLE_NAMES, syncState, type SyncTableName } from '../db/schema';
import { deleteRows, dropLocalCopies, putRow, type Row } from '../db/store';
import type { Db } from '../db/types';
import type { PullResponse, SyncApi } from './api';
import { protectedRows } from './outbox';

export function getSyncState(db: Db) {
  return db.select().from(syncState).where(eq(syncState.id, 1)).get() ?? { id: 1, cursor: null, lastPullAt: null, lastPushAt: null, lastError: null };
}

export function setSyncState(db: Db, patch: Partial<typeof syncState.$inferInsert>) {
  const row = { ...getSyncState(db), ...patch, id: 1 };
  db.insert(syncState).values(row).onConflictDoUpdate({ target: syncState.id, set: row }).run();
}

/** Empties every mirrored table, except rows made on the phone that are still waiting to be sent. */
export function wipeMirror(db: Db) {
  db.transaction((tx) => {
    for (const name of SYNC_TABLE_NAMES) tx.delete(SYNC_TABLES[name]).where(eq(SYNC_TABLES[name].local, 0)).run();
  });
  setSyncState(db, { cursor: null });
}

function dropAttendanceCopies(db: Db, row: Row) {
  const t = SYNC_TABLES.attendance;
  const locals = db.select().from(t).where(and(eq(t.local, 1), ne(t.id, row.id))).all();
  for (const l of locals) {
    const d = JSON.parse(l.data) as Row;
    if (d['projectId'] === row['projectId'] && d['workerId'] === row['workerId'] && d['date'] === row['date']) db.delete(t).where(eq(t.id, l.id)).run();
  }
}

export function applyPull(db: Db, res: PullResponse, snapshot: boolean, now = Date.now()) {
  db.transaction((tx) => {
    const t = tx as unknown as Db;
    const keep = protectedRows(t);
    for (const [name, change] of Object.entries(res.changes)) {
      if (!(name in SYNC_TABLES)) continue;
      const table = name as SyncTableName;
      const tbl = SYNC_TABLES[table];
      if (snapshot) {
        const keepIds = [...keep].filter((k) => k.startsWith(`${table}:`)).map((k) => k.slice(table.length + 1));
        // Server rows are replaced; rows made on the phone stay until the push decides them.
        t.delete(tbl).where(keepIds.length ? and(eq(tbl.local, 0), notInArray(tbl.id, keepIds)) : eq(tbl.local, 0)).run();
      }
      for (const row of change.upserts) {
        if (keep.has(`${table}:${row.id}`)) continue;
        putRow(t, table, row);
        if (typeof row['clientId'] === 'string') dropLocalCopies(t, table, row['clientId'] as string, row.id);
        if (table === 'attendance') dropAttendanceCopies(t, row);
      }
      deleteRows(
        t,
        table,
        change.deletes.filter((id) => !keep.has(`${table}:${id}`)),
      );
    }
    setSyncState(t, { cursor: res.cursor, lastPullAt: now });
  });
}

export async function pullAll(db: Db, api: SyncApi, now = Date.now()): Promise<{ pages: number; reset: boolean }> {
  let pages = 0;
  let reset = false;
  for (let guard = 0; guard < 1000; guard++) {
    const cursor = getSyncState(db).cursor ?? undefined;
    const res = await api.pull(cursor);
    if (res.resetRequired) {
      if (reset) throw new Error('Server asked for a reset twice');
      reset = true;
      wipeMirror(db);
      continue;
    }
    applyPull(db, res, cursor === undefined, now);
    pages += 1;
    if (!res.hasMore) break;
  }
  return { pages, reset };
}
