/**
 * Background sync scheduling (src/sync/triggers.ts). The OS side (WorkManager waking the app)
 * can only be checked in a dev / pilot build — see docs/RELEASE.md → Background sync check.
 */
import { AppState } from 'react-native';
import type { SyncStatus } from '../../src/sync/engine';

const mockDefineTask = jest.fn();
const mockIsRegistered = jest.fn(async () => true);
const mockRegister = jest.fn(async () => undefined);
const mockUnregister = jest.fn(async () => undefined);
const mockStatus = jest.fn(async () => 2); // Available
const mockSyncNow = jest.fn(async (): Promise<Partial<SyncStatus>> => ({ phase: 'idle' }));
const mockGetUser = jest.fn(async (): Promise<unknown> => ({ id: 'u1' }));
let mockNetListener: ((s: unknown) => void) | null = null;
const mockNetUnsubscribe = jest.fn();
let mockAppListener: ((s: string) => void) | null = null;
const mockAppRemove = jest.fn();

jest.mock('expo-task-manager', () => ({
  defineTask: (...a: unknown[]) => mockDefineTask(...a),
  isTaskRegisteredAsync: () => mockIsRegistered(),
}));
jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: () => mockStatus(),
  registerTaskAsync: (...a: unknown[]) => mockRegister(...(a as [])),
  unregisterTaskAsync: (...a: unknown[]) => mockUnregister(...(a as [])),
  triggerTaskWorkerForTestingAsync: jest.fn(async () => true),
}));
jest.mock('../../src/api/session', () => ({ getDeviceId: async () => 'dev-1', getUser: () => mockGetUser() }));
jest.mock('../../src/db/client', () => ({ getDb: () => ({ db: 'app' }), openDb: async () => ({ db: 'headless' }) }));
jest.mock('../../src/db/live', () => ({ notifyChange: jest.fn() }));
jest.mock('../../src/sync/engine', () => ({ syncNow: (...a: unknown[]) => mockSyncNow(...(a as [])) }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (l: (s: unknown) => void) => {
      mockNetListener = l;
      return mockNetUnsubscribe;
    },
    fetch: async () => ({ type: 'wifi', isConnected: true }),
  },
}));
// Required after the mocks above (an import would be hoisted before the mock functions exist).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BACKGROUND_SYNC, backgroundIntervalMinutes, registerBackgroundSync, runBackgroundSync, shouldSyncOnNetChange, startSyncTriggers, stopBackgroundSync } = require('../../src/sync/triggers') as typeof import('../../src/sync/triggers');

const flush = () => new Promise((r) => setTimeout(r, 0));
const CELL = { type: 'cellular', isConnected: true, isInternetReachable: true };
const WIFI = { type: 'wifi', isConnected: true, isInternetReachable: true };
const NONE = { type: 'none', isConnected: false, isInternetReachable: false };

beforeEach(() => {
  mockSyncNow.mockClear();
  mockRegister.mockClear();
  mockUnregister.mockClear();
  mockGetUser.mockImplementation(async () => ({ id: 'u1' }));
  mockStatus.mockImplementation(async () => 2);
});

describe('background sync task', () => {
  it('is defined at import time (module scope) under its fixed name', () => {
    expect(mockDefineTask).toHaveBeenCalledWith(BACKGROUND_SYNC, runBackgroundSync);
    expect(BACKGROUND_SYNC).toBe('munshi-background-sync');
  });

  it('syncs with the headless database and the Wi-Fi-only policy; offline is not a failure', async () => {
    expect(await runBackgroundSync()).toBe(1);
    expect(mockSyncNow).toHaveBeenCalledWith({ db: 'headless' }, expect.anything(), expect.objectContaining({ deviceId: 'dev-1', canUpload: expect.any(Function) }));
    mockSyncNow.mockImplementationOnce(async () => ({ phase: 'offline' }));
    expect(await runBackgroundSync()).toBe(1);
    mockSyncNow.mockImplementationOnce(async () => ({ phase: 'error' }));
    expect(await runBackgroundSync()).toBe(2);
    mockSyncNow.mockImplementationOnce(async () => Promise.reject(new Error('db locked')));
    expect(await runBackgroundSync()).toBe(2);
  });

  it('does nothing when nobody is signed in', async () => {
    mockGetUser.mockImplementation(async () => null);
    expect(await runBackgroundSync()).toBe(1);
    expect(mockSyncNow).not.toHaveBeenCalled();
  });

  it('interval: the server value, never below the 15 minutes Android allows', () => {
    expect(backgroundIntervalMinutes(30)).toBe(30);
    expect(backgroundIntervalMinutes(5)).toBe(15);
    expect(backgroundIntervalMinutes(null)).toBe(15);
    expect(backgroundIntervalMinutes(Number.NaN)).toBe(15);
  });

  it('registers only when background tasks are available, and never throws', async () => {
    expect(await registerBackgroundSync(5)).toBe(true);
    expect(mockRegister).toHaveBeenCalledWith(BACKGROUND_SYNC, { minimumInterval: 15 });
    mockStatus.mockImplementation(async () => 1); // Restricted (battery saver / Expo Go)
    expect(await registerBackgroundSync(30)).toBe(false);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    mockStatus.mockImplementation(async () => Promise.reject(new Error('no native module')));
    expect(await registerBackgroundSync(30)).toBe(false);
  });

  it('logout unregisters it only when it is registered', async () => {
    mockIsRegistered.mockImplementationOnce(async () => false);
    await stopBackgroundSync();
    expect(mockUnregister).not.toHaveBeenCalled();
    await stopBackgroundSync();
    expect(mockUnregister).toHaveBeenCalledWith(BACKGROUND_SYNC);
  });
});

describe('foreground triggers', () => {
  it('network change: sync when it comes back or moves from mobile data to Wi-Fi', () => {
    expect(shouldSyncOnNetChange(null, WIFI)).toBe(false); // first event: startSyncTriggers already synced
    expect(shouldSyncOnNetChange(NONE, CELL)).toBe(true);
    expect(shouldSyncOnNetChange(CELL, WIFI)).toBe(true);
    expect(shouldSyncOnNetChange(WIFI, CELL)).toBe(false);
    expect(shouldSyncOnNetChange(WIFI, WIFI)).toBe(false);
    expect(shouldSyncOnNetChange(CELL, NONE)).toBe(false);
    expect(shouldSyncOnNetChange(CELL, { ...WIFI, isInternetReachable: false })).toBe(false);
  });

  it('startSyncTriggers: syncs now, registers the task, listens to foreground and network; cleanup removes listeners', async () => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, l) => {
      mockAppListener = l as (s: string) => void;
      return { remove: mockAppRemove } as never;
    });
    const stop = startSyncTriggers(20);
    await flush();
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith(BACKGROUND_SYNC, { minimumInterval: 20 });

    mockAppListener!('background');
    mockAppListener!('active');
    mockNetListener!(CELL);
    mockNetListener!(WIFI);
    await flush();
    expect(mockSyncNow).toHaveBeenCalledTimes(3); // start + foreground + joined Wi-Fi

    stop();
    expect(mockAppRemove).toHaveBeenCalled();
    expect(mockNetUnsubscribe).toHaveBeenCalled();
  });
});
