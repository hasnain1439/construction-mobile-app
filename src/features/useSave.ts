/** Runs a write action, refreshes the screens and starts a sync in the background. */
import { useCallback } from 'react';
import { getDb } from '../db/client';
import { notifyChange } from '../db/live';
import type { Db } from '../db/types';
import { refreshStatus } from '../sync/engine';
import { syncFromApp } from '../sync/triggers';
import type { Ctx } from './actions';
import { useUser } from './session';

export function useSave() {
  const user = useUser();
  return useCallback(
    <T,>(action: (db: Db, ctx: Ctx) => T): T => {
      const db = getDb();
      const result = action(db, { userId: user.id, userName: user.name });
      notifyChange();
      refreshStatus(db);
      void syncFromApp();
      return result;
    },
    [user],
  );
}
