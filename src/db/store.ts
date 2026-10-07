/**
 * Generic access to the mirrored tables: rows are the server's JSON in `data`. Used by the
 * sync engine (pull apply, rollback) and by the optimistic writers.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { SYNC_TABLES, type SyncTableName } from './schema';
import type { Db } from './types';

export type Row = { id: string } & Record<string, unknown>;

export function projectOf(table: SyncTableName, row: Row): string | null {
  if (table === 'projects') return row.id;
  const p = row['projectId'];
  return typeof p === 'string' ? p : null;
}

/** Insert or replace one row (sync — safe inside a transaction). */
export function putRow(db: Db, table: SyncTableName, row: Row, local = false) {
  const t = SYNC_TABLES[table];
  const values = {
    id: row.id,
    projectId: projectOf(table, row),
    clientId: typeof row['clientId'] === 'string' ? (row['clientId'] as string) : null,
    local: local ? 1 : 0,
    data: JSON.stringify(row),
    updatedAt: Date.now(),
  };
  db.insert(t).values(values).onConflictDoUpdate({ target: t.id, set: values }).run();
}

export function getRow<T extends Row = Row>(db: Db, table: SyncTableName, id: string): T | null {
  const t = SYNC_TABLES[table];
  const r = db.select().from(t).where(eq(t.id, id)).get();
  return r ? (JSON.parse(r.data) as T) : null;
}

export function deleteRows(db: Db, table: SyncTableName, ids: string[]) {
  if (!ids.length) return;
  const t = SYNC_TABLES[table];
  db.delete(t).where(inArray(t.id, ids)).run();
}

export function listRows<T extends Row = Row>(db: Db, table: SyncTableName, projectId?: string | null): T[] {
  const t = SYNC_TABLES[table];
  const rows = projectId ? db.select().from(t).where(eq(t.projectId, projectId)).all() : db.select().from(t).all();
  return rows.map((r) => JSON.parse(r.data) as T);
}

/** Renames an optimistic row (clientId) to the id the server gave it. */
export function renameRow(db: Db, table: SyncTableName, fromId: string, toId: string) {
  const t = SYNC_TABLES[table];
  const r = db.select().from(t).where(eq(t.id, fromId)).get();
  if (!r || fromId === toId) return;
  const data = { ...(JSON.parse(r.data) as Row), id: toId };
  db.delete(t).where(eq(t.id, toId)).run();
  db.update(t).set({ id: toId, data: JSON.stringify(data) }).where(eq(t.id, fromId)).run();
}

/** Optimistic copies of a server row (same clientId, different id) are dropped when it arrives. */
export function dropLocalCopies(db: Db, table: SyncTableName, clientId: string, keepId: string) {
  const t = SYNC_TABLES[table];
  const copies = db.select({ id: t.id }).from(t).where(and(eq(t.clientId, clientId), eq(t.local, 1))).all();
  const ids = copies.map((c) => c.id).filter((i) => i !== keepId);
  if (ids.length) db.delete(t).where(inArray(t.id, ids)).run();
}
