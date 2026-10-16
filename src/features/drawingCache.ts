/**
 * Drawing files for offline viewing. The file of a revision is fetched once (online) through a
 * fresh signed link (`GET /attachments/:id`) and kept in the app's documents folder, named by the
 * attachment id; the encrypted DB (`kv`) remembers which ones are on the phone. A new revision has
 * a new attachment id, so the old file is dropped when its drawing moves on. Logout deletes them all.
 */
import { eq, like } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';
import { request } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { getKv, setKv } from '../db/kv';
import { kv } from '../db/schema';
import type { Db } from '../db/types';

const PREFIX = 'drawing.file.';
const DIR = 'drawings';

export interface CachedDrawing {
  attachmentId: string;
  uri: string;
  mimeType: string;
  fileName: string;
  savedAt: string;
}

interface AttachmentInfo {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
}

function folder(): Directory {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

export const isImage = (mimeType: string) => mimeType.startsWith('image/');

/** File extension from the type (the name the office uploaded is only a fallback). */
export function extensionOf(mimeType: string, fileName = ''): string {
  const known: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  return known[mimeType] ?? /\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1]?.toLowerCase() ?? 'bin';
}

/** The copy on this phone (null when never opened or the file is gone). */
export function cachedDrawing(db: Db, attachmentId: string | null | undefined): CachedDrawing | null {
  if (!attachmentId) return null;
  const raw = getKv(db, PREFIX + attachmentId);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CachedDrawing;
    return new File(c.uri).exists ? c : null;
  } catch {
    return null;
  }
}

/** Online: signed link → download into the documents folder → remember it. Throws NetworkError offline. */
export async function downloadDrawing(db: Db, attachmentId: string, now = new Date()): Promise<CachedDrawing> {
  const a = await request<AttachmentInfo>(`${ENDPOINTS.attachments}/${attachmentId}`);
  const dest = new File(folder(), `${attachmentId}.${extensionOf(a.mimeType, a.fileName)}`);
  const file = await File.downloadFileAsync(a.url, dest, { idempotent: true });
  const c: CachedDrawing = { attachmentId, uri: file.uri, mimeType: a.mimeType, fileName: a.fileName, savedAt: now.toISOString() };
  setKv(db, PREFIX + attachmentId, JSON.stringify(c));
  return c;
}

/** Drops files whose revision is no longer the latest of any drawing on the phone. */
export function pruneDrawingCache(db: Db, keepAttachmentIds: readonly string[]) {
  const keep = new Set(keepAttachmentIds);
  for (const row of db.select().from(kv).where(like(kv.key, `${PREFIX}%`)).all()) {
    const id = row.key.slice(PREFIX.length);
    if (keep.has(id)) continue;
    try {
      const c = JSON.parse(row.value) as CachedDrawing;
      const f = new File(c.uri);
      if (f.exists) f.delete();
    } catch {
      // a broken entry: just forget it
    }
    db.delete(kv).where(eq(kv.key, row.key)).run();
  }
}

/** Logout: nothing of the company stays on the phone (the kv rows go with wipeAll). */
export function clearDrawingCache() {
  try {
    const d = new Directory(Paths.document, DIR);
    if (d.exists) d.delete();
  } catch {
    // nothing saved yet
  }
}
