/**
 * Opens the encrypted local database. The SQLCipher key is random per install and kept in
 * SecureStore. Expo Go has no SQLCipher, so there (development only) the file is not encrypted.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseSync } from 'expo-sqlite';
import migrations from './migrations/migrations';
import * as schema from './schema';
import type { Db } from './types';

const KEY = 'db.key';
export const DB_NAME = 'munshi.db';
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let db: Db | null = null;

async function dbKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(KEY);
  if (!key) {
    key = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY, key);
  }
  return key;
}

export async function openDb(): Promise<Db> {
  if (db) return db;
  const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
  if (!isExpoGo) sqlite.execSync(`PRAGMA key = '${await dbKey()}'`);
  sqlite.execSync('PRAGMA journal_mode = WAL');
  const d = drizzle(sqlite, { schema }) as unknown as Db;
  await migrate(d as never, migrations);
  db = d;
  return d;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not opened yet');
  return db;
}
