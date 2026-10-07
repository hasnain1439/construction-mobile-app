import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/** The local database (expo-sqlite on the phone, better-sqlite3 in tests) — a synchronous drizzle db. */
 
export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>;
