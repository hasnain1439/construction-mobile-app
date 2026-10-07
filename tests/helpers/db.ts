/** A fresh in-memory database with the app's real migrations (better-sqlite3 stands in for expo-sqlite). */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../../src/db/schema';
import type { Db } from '../../src/db/types';

export function testDb(): Db {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../src/db/migrations') });
  return db as unknown as Db;
}
