/**
 * The signed-in person's permissions, kept in the encrypted local database (`kv`) so the app
 * shows the right tabs and buttons offline. Written on sign-in, by `/auth/me` on app start and
 * by every sync pull (`access`); wiped with everything else on logout.
 */
import { accessFrom, type Access } from '../lib/permissions';
import { getKv, setKv } from './kv';
import type { Db } from './types';

export const ACCESS_KEY = 'auth.access';

export function readAccess(db: Db): Access | null {
  const raw = getKv(db, ACCESS_KEY);
  if (!raw) return null;
  try {
    return accessFrom(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Stores the block when the answer has one (an older server sends none: keep what we have). */
export function saveAccess(db: Db, src: unknown): Access | null {
  const access = accessFrom(src);
  if (access) setKv(db, ACCESS_KEY, JSON.stringify(access));
  return access;
}
