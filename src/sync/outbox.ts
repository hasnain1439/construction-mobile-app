/**
 * Local-first writes: a screen calls `enqueue` with the mutation for the server AND the rows it
 * changes on the phone. Both happen in one SQLite transaction, so the UI shows the change at
 * once; `before` snapshots let a REJECTED mutation be rolled back exactly.
 */
import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm';
import { outbox, type SyncTableName } from '../db/schema';
import { deleteRows, getRow, putRow, type Row } from '../db/store';
import type { Db } from '../db/types';
import { uuidv7 } from '../lib/uuid';

export type MutationType =
  | 'WORKER_CREATE'
  | 'PROJECT_WORKER_ASSIGN'
  | 'ATTENDANCE_UPSERT'
  | 'ADVANCE_CREATE'
  | 'WORK_MEASUREMENT_CREATE'
  | 'SETTLEMENT_GENERATE'
  | 'SETTLEMENT_SUBMIT'
  | 'SETTLEMENT_PAY'
  | 'DISPATCH_RECEIVE'
  | 'PURCHASE_RECEIVE'
  | 'OWNER_DELIVERY_CREATE'
  | 'MATERIAL_USAGE_CREATE'
  | 'STOCK_COUNT_CREATE'
  | 'CASH_EXPENSE_CREATE'
  | 'FLOAT_ACKNOWLEDGE'
  | 'TOPUP_REQUEST_CREATE'
  | 'DAILY_LOG_UPSERT'
  | 'SITE_PURCHASE_CREATE';

export type OutboxStatus = 'PENDING' | 'SENDING' | 'APPLIED' | 'REJECTED';

export interface LocalChange {
  table: SyncTableName;
  id: string;
  before: { row: Row; local: boolean } | null;
}

export interface Write {
  table: SyncTableName;
  row: Row;
}

export interface EnqueueInput {
  type: MutationType;
  payload: Record<string, unknown>;
  label: string;
  writes?: Write[];
  dependsOn?: string[];
  clientId?: string;
}

export type OutboxItem = typeof outbox.$inferSelect;

/** Saves the optimistic rows + the mutation; returns its clientId. */
export function enqueue(db: Db, input: EnqueueInput, now = new Date()): string {
  const clientId = input.clientId ?? uuidv7(now.getTime());
  db.transaction((tx) => {
    const changes: LocalChange[] = [];
    for (const w of input.writes ?? []) {
      const before = getRowWithFlag(tx as unknown as Db, w.table, w.row.id);
      putRow(tx as unknown as Db, w.table, w.row, true);
      changes.push({ table: w.table, id: w.row.id, before });
    }
    const last = tx.select({ m: max(outbox.seq) }).from(outbox).get();
    tx.insert(outbox)
      .values({
        clientId,
        seq: (last?.m ?? 0) + 1,
        type: input.type,
        payload: JSON.stringify(input.payload),
        dependsOn: JSON.stringify(input.dependsOn ?? []),
        status: 'PENDING',
        localChanges: JSON.stringify(changes),
        label: input.label,
        deviceCreatedAt: now.toISOString(),
        createdAt: now.getTime(),
      })
      .run();
  });
  return clientId;
}

function getRowWithFlag(db: Db, table: SyncTableName, id: string): LocalChange['before'] {
  const row = getRow(db, table, id);
  if (!row) return null;
  const flag = db.all<{ local: number }>(sql`SELECT local FROM ${sql.identifier(table)} WHERE id = ${id}`)[0];
  return { row, local: flag?.local === 1 };
}

/** Puts back what the optimistic write changed (newest change first). */
export function rollback(db: Db, item: OutboxItem) {
  const changes = JSON.parse(item.localChanges) as LocalChange[];
  for (const c of [...changes].reverse()) {
    if (c.before) putRow(db, c.table, c.before.row, c.before.local);
    else deleteRows(db, c.table, [c.id]);
  }
}

/** Rows touched by mutations still waiting — a pull must not overwrite them yet. */
export function protectedRows(db: Db): Set<string> {
  const items = db
    .select({ localChanges: outbox.localChanges })
    .from(outbox)
    .where(inArray(outbox.status, ['PENDING', 'SENDING']))
    .all();
  const out = new Set<string>();
  for (const i of items) for (const c of JSON.parse(i.localChanges) as LocalChange[]) out.add(`${c.table}:${c.id}`);
  return out;
}

export function pendingCount(db: Db): number {
  return db.select({ n: sql<number>`count(*)` }).from(outbox).where(inArray(outbox.status, ['PENDING', 'SENDING'])).get()?.n ?? 0;
}

export function problems(db: Db): OutboxItem[] {
  return db
    .select()
    .from(outbox)
    .where(and(eq(outbox.status, 'REJECTED'), eq(outbox.dismissed, 0)))
    .orderBy(desc(outbox.seq))
    .all();
}

export function dismissProblem(db: Db, clientId: string) {
  db.update(outbox).set({ dismissed: 1 }).where(eq(outbox.clientId, clientId)).run();
}

export function pendingItems(db: Db): OutboxItem[] {
  return db.select().from(outbox).where(inArray(outbox.status, ['PENDING', 'SENDING'])).orderBy(asc(outbox.seq)).all();
}
