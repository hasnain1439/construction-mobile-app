/**
 * When a sync runs: app comes to the foreground, the network comes back (or the phone joins
 * Wi-Fi, for photos held by "Wi-Fi only"), every ~15 minutes in the background (OS-scheduled,
 * best effort; dev / store builds only, not Expo Go), and pull-to-refresh (`useRefresh`).
 *
 * Background path: `TaskManager.defineTask` runs at module scope (app/_layout.tsx imports this
 * file first thing), so a headless start can find the task; `startSyncTriggers` registers it with
 * expo-background-task (Android WorkManager, needs network) once signed in; logout unregisters it.
 * How to check it on a device: docs/RELEASE.md → "Background sync check".
 */
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { getDeviceId, getUser } from '../api/session';
import { getDb, openDb } from '../db/client';
import { notifyChange } from '../db/live';
import { httpSyncApi } from './api';
import { syncNow } from './engine';
import { canUploadNow, isUnmetered, type NetLike } from './uploadPolicy';

export const BACKGROUND_SYNC = 'munshi-background-sync';
/** Android WorkManager will not run a periodic task more often than every 15 minutes. */
export const MIN_BACKGROUND_MINUTES = 15;

/** The server's syncIntervalMinutes, kept within what the OS allows. */
export const backgroundIntervalMinutes = (fromServer: number | null | undefined) => Math.max(MIN_BACKGROUND_MINUTES, Math.round(Number.isFinite(fromServer) && fromServer ? fromServer : MIN_BACKGROUND_MINUTES));

export const isOnline = (s: { isConnected: boolean | null; isInternetReachable?: boolean | null } | null | undefined) => !!s?.isConnected && s.isInternetReachable !== false;

/** Network change → sync? When it comes back, or when it switches from mobile data to Wi-Fi. */
export function shouldSyncOnNetChange(prev: (NetLike & { isInternetReachable?: boolean | null }) | null, next: NetLike & { isInternetReachable?: boolean | null }): boolean {
  if (!isOnline(next)) return false;
  if (!prev || !isOnline(prev)) return prev !== null;
  return !isUnmetered(prev) && isUnmetered(next);
}

/** Every sync started by the app; screens re-read the local database afterwards. */
export async function syncFromApp() {
  try {
    return await syncNow(getDb(), httpSyncApi, { deviceId: (await getDeviceId()) ?? undefined, canUpload: () => canUploadNow() });
  } finally {
    notifyChange();
  }
}

/** The background task body (exported for tests). Nobody signed in → nothing to do. */
export async function runBackgroundSync(): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    if (!(await getUser())) return BackgroundTask.BackgroundTaskResult.Success;
    const db = await openDb();
    const st = await syncNow(db, httpSyncApi, { deviceId: (await getDeviceId()) ?? undefined, canUpload: () => canUploadNow() });
    // Offline is a normal outcome in the background, not a failure.
    return st.phase === 'error' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// Must be defined at module scope so the OS can wake the task with the app closed.
TaskManager.defineTask(BACKGROUND_SYNC, runBackgroundSync);

// Dev builds only: run the registered task now from the React Native DevTools console with
// `__munshiRunBackgroundSync()` (see docs/RELEASE.md → Background sync check).
if (__DEV__) (globalThis as { __munshiRunBackgroundSync?: () => Promise<boolean> }).__munshiRunBackgroundSync = () => BackgroundTask.triggerTaskWorkerForTestingAsync();

/** Registers the periodic task (idempotent: registering again only updates the interval). */
export async function registerBackgroundSync(minutes: number): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC, { minimumInterval: backgroundIntervalMinutes(minutes) });
    return true;
  } catch {
    return false;
  }
}

/** Call once after sign-in; returns a function that removes the listeners. */
export function startSyncTriggers(intervalMinutes = MIN_BACKGROUND_MINUTES): () => void {
  let last: (NetLike & { isInternetReachable?: boolean | null }) | null = null;
  const app = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncFromApp();
  });
  const net = NetInfo.addEventListener((state) => {
    if (shouldSyncOnNetChange(last, state)) void syncFromApp();
    last = state;
  });
  void registerBackgroundSync(intervalMinutes);
  void syncFromApp();
  return () => {
    app.remove();
    net();
  };
}

export async function stopBackgroundSync() {
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC)) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC);
}

/** Pull-to-refresh for any list. */
export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncFromApp();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
