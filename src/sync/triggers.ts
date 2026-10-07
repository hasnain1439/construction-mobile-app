/**
 * When a sync runs: app comes to the foreground, the network comes back, every 15 minutes in
 * the background (OS-scheduled, best effort), and pull-to-refresh (`useRefresh`).
 */
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { getDeviceId } from '../api/session';
import { getDb, openDb } from '../db/client';
import { notifyChange } from '../db/live';
import { httpSyncApi } from './api';
import { syncNow } from './engine';

export const BACKGROUND_SYNC = 'munshi-background-sync';

/** Every sync started by the app; screens re-read the local database afterwards. */
export async function syncFromApp() {
  try {
    return await syncNow(getDb(), httpSyncApi, { deviceId: (await getDeviceId()) ?? undefined });
  } finally {
    notifyChange();
  }
}

// Must be defined at module scope so the OS can wake the task with the app closed.
TaskManager.defineTask(BACKGROUND_SYNC, async () => {
  try {
    const db = await openDb();
    const st = await syncNow(db, httpSyncApi, { deviceId: (await getDeviceId()) ?? undefined });
    return st.phase === 'idle' ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Call once after sign-in; returns a function that removes the listeners. */
export function startSyncTriggers(intervalMinutes = 15): () => void {
  let wasOffline = false;
  const app = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncFromApp();
  });
  const net = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (online && wasOffline) void syncFromApp();
    wasOffline = !online;
  });
  void BackgroundTask.registerTaskAsync(BACKGROUND_SYNC, { minimumInterval: intervalMinutes }).catch(() => undefined);
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
