/**
 * Photos and voice notes are saved to app storage first and queued. They are uploaded BEFORE
 * the outbox is pushed (the mutations reference them by clientId; the server resolves it).
 */
import { asc, eq, or, sql } from 'drizzle-orm';
import { ApiError, NetworkError } from '../api/client';
import { attachmentsQueue } from '../db/schema';
import type { Db } from '../db/types';
import { uuidv7 } from '../lib/uuid';
import type { SyncApi } from './api';

export type AttachmentKind = 'SITE_PHOTO' | 'RECEIPT' | 'CHALLAN' | 'VOICE_NOTE';

export function queueAttachment(db: Db, a: { localUri: string; kind: AttachmentKind; mimeType: string }, now = Date.now()): string {
  const clientId = uuidv7(now);
  db.insert(attachmentsQueue).values({ clientId, localUri: a.localUri, kind: a.kind, mimeType: a.mimeType, status: 'PENDING', createdAt: now }).run();
  return clientId;
}

export const pendingAttachments = (db: Db) => db.select({ n: sql<number>`count(*)` }).from(attachmentsQueue).where(eq(attachmentsQueue.status, 'PENDING')).get()?.n ?? 0;

/** The file on this phone for an attachment id (its clientId, or the server id once uploaded). */
export const localUriOf = (db: Db, id: string) =>
  db.select().from(attachmentsQueue).where(or(eq(attachmentsQueue.clientId, id), eq(attachmentsQueue.serverId, id))).get()?.localUri ?? null;

export async function uploadPending(db: Db, api: SyncApi): Promise<{ uploaded: number; failed: number }> {
  const items = db.select().from(attachmentsQueue).where(eq(attachmentsQueue.status, 'PENDING')).orderBy(asc(attachmentsQueue.createdAt)).all();
  let uploaded = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await api.upload(item);
      db.update(attachmentsQueue).set({ status: 'UPLOADED', serverId: res.id }).where(eq(attachmentsQueue.clientId, item.clientId)).run();
      uploaded += 1;
    } catch (err) {
      if (err instanceof NetworkError) throw err; // stop; try again later
      failed += 1;
      const code = err instanceof ApiError ? err.code : 'UPLOAD_FAILED';
      db.update(attachmentsQueue)
        .set({ status: item.attempts + 1 >= 3 ? 'FAILED' : 'PENDING', attempts: item.attempts + 1, lastError: code })
        .where(eq(attachmentsQueue.clientId, item.clientId))
        .run();
    }
  }
  return { uploaded, failed };
}
