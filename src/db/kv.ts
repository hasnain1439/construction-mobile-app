import { eq } from 'drizzle-orm';
import { SYNC_TABLES, SYNC_TABLE_NAMES, attachmentsQueue, kv, outbox, syncState } from './schema';
import type { Db } from './types';

export const getKv = (db: Db, key: string) => db.select().from(kv).where(eq(kv.key, key)).get()?.value ?? null;

export function setKv(db: Db, key: string, value: string) {
  db.insert(kv).values({ key, value }).onConflictDoUpdate({ target: kv.key, set: { value } }).run();
}

/** Logout / revoked phone: nothing of the company stays on the device. */
export function wipeAll(db: Db) {
  db.transaction((tx) => {
    for (const name of SYNC_TABLE_NAMES) tx.delete(SYNC_TABLES[name]).run();
    tx.delete(outbox).run();
    tx.delete(attachmentsQueue).run();
    tx.delete(syncState).run();
    tx.delete(kv).run();
  });
}
