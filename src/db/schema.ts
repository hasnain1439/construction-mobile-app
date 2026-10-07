/**
 * Local read model + outbox. Every pulled table mirrors a server sync table: the row as the
 * server sent it lives in `data` (JSON); the columns next to it are what screens filter on.
 * `local = 1` marks a row written on the phone that the server has not confirmed yet.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const record = (name: string) =>
  sqliteTable(
    name,
    {
      id: text('id').primaryKey(),
      projectId: text('project_id'),
      clientId: text('client_id'),
      local: integer('local').notNull().default(0),
      data: text('data').notNull(),
      updatedAt: integer('updated_at').notNull().default(0),
    },
    (t) => [index(`${name}_project_idx`).on(t.projectId), index(`${name}_client_idx`).on(t.clientId)],
  );

export const projects = record('projects');
export const stockLocations = record('stock_locations');
export const materials = record('materials');
export const materialGroups = record('material_groups');
export const suppliers = record('suppliers');
export const workers = record('workers');
export const projectWorkers = record('project_workers');
export const subcontractAssignments = record('subcontract_assignments');
export const attendance = record('attendance');
export const settlements = record('settlements');
export const advances = record('advances');
export const workMeasurements = record('work_measurements');
export const dispatches = record('dispatches');
export const purchases = record('purchases');
export const ownerDeliveries = record('owner_deliveries');
export const materialUsage = record('material_usage');
export const siteStock = record('site_stock');
export const stockCounts = record('stock_counts');
export const dailyLogs = record('daily_logs');
export const cashAccounts = record('cash_accounts');
export const cashEntries = record('cash_entries');
export const topupRequests = record('topup_requests');
export const settings = record('settings');
export const holidays = record('holidays');
export const notifications = record('notifications');

/** Server table name (from /sync/pull) → local table. */
export const SYNC_TABLES = {
  projects,
  stock_locations: stockLocations,
  materials,
  material_groups: materialGroups,
  suppliers,
  workers,
  project_workers: projectWorkers,
  subcontract_assignments: subcontractAssignments,
  attendance,
  settlements,
  advances,
  work_measurements: workMeasurements,
  dispatches,
  purchases,
  owner_deliveries: ownerDeliveries,
  material_usage: materialUsage,
  site_stock: siteStock,
  stock_counts: stockCounts,
  daily_logs: dailyLogs,
  cash_accounts: cashAccounts,
  cash_entries: cashEntries,
  topup_requests: topupRequests,
  settings,
  holidays,
  notifications,
} as const;
export type SyncTableName = keyof typeof SYNC_TABLES;
export const SYNC_TABLE_NAMES = Object.keys(SYNC_TABLES) as SyncTableName[];

/** Mutations waiting for /sync/push (in creation order). */
export const outbox = sqliteTable(
  'outbox',
  {
    clientId: text('client_id').primaryKey(),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    dependsOn: text('depends_on').notNull().default('[]'),
    /** PENDING · SENDING · APPLIED · REJECTED */
    status: text('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
    lastError: text('last_error'),
    serverId: text('server_id'),
    /** What the optimistic write changed: [{ table, id, before }] — restored on REJECTED. */
    localChanges: text('local_changes').notNull().default('[]'),
    /** Short human label for "Sync problems" ("Kharcha Rs 1,200 — chai"). */
    label: text('label').notNull().default(''),
    deviceCreatedAt: text('device_created_at').notNull(),
    createdAt: integer('created_at').notNull(),
    dismissed: integer('dismissed').notNull().default(0),
  },
  (t) => [index('outbox_status_idx').on(t.status, t.seq)],
);

/** Photos / voice notes waiting to be uploaded (POST /attachments with the same clientId). */
export const attachmentsQueue = sqliteTable('attachments_queue', {
  clientId: text('client_id').primaryKey(),
  localUri: text('local_uri').notNull(),
  kind: text('kind').notNull(),
  mimeType: text('mime_type').notNull(),
  /** PENDING · UPLOADED · FAILED */
  status: text('status').notNull().default('PENDING'),
  serverId: text('server_id'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
});

/** One row (id = 1): pull cursor and timings. */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  cursor: text('cursor'),
  lastPullAt: integer('last_pull_at'),
  lastPushAt: integer('last_push_at'),
  lastError: text('last_error'),
});

/** Small app preferences (selected site …). */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
