/**
 * Screens read the local database synchronously and re-read it whenever something changed
 * (an optimistic write, a push result, a pull). One global version counter is enough here:
 * the data set is small and every query is a cheap indexed read.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { getDb } from './client';
import type { Db } from './types';

let version = 0;
const subscribers = new Set<() => void>();

export function notifyChange() {
  version += 1;
  subscribers.forEach((s) => s());
}

const subscribe = (cb: () => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};

export const useDbVersion = () => useSyncExternalStore(subscribe, () => version);

/** `useQuery((db) => listRows(db, 'workers'), [])` — re-runs after every local change. */
export function useQuery<T>(fn: (db: Db) => T, deps: unknown[]): T {
  const v = useDbVersion();
  const key = JSON.stringify(deps);
  // `fn` is a new closure every render; it only reads `deps`, which `key` covers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(getDb()), [v, key]);
}
