/**
 * "Upload photos on Wi-Fi only" (Mazeed → setting). A phone setting, not company data: it is kept
 * in SecureStore like the language and survives logout. When it is on and the phone is on mobile
 * data, photos and voice notes stay queued; entries that point at one of them wait too (the
 * server needs the file first), everything else syncs as usual. Joining Wi-Fi starts a sync.
 */
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

export const WIFI_ONLY_KEY = 'sync.uploadWifiOnly';

/** The NetInfo fields used here. */
export interface NetLike {
  type: string;
  isConnected: boolean | null;
}

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

export async function getWifiOnly(): Promise<boolean> {
  if (cached === null) cached = (await SecureStore.getItemAsync(WIFI_ONLY_KEY).catch(() => null)) === '1';
  return cached;
}

export async function setWifiOnly(on: boolean): Promise<void> {
  cached = on;
  listeners.forEach((l) => l(on));
  await SecureStore.setItemAsync(WIFI_ONLY_KEY, on ? '1' : '0');
}

/** Wi-Fi or cable: files may go even with "Wi-Fi only". Mobile data, unknown or none: not. */
export const isUnmetered = (net: NetLike | null | undefined) => !!net?.isConnected && (net.type === 'wifi' || net.type === 'ethernet');

export const uploadsAllowed = (wifiOnly: boolean, net: NetLike | null | undefined) => !wifiOnly || isUnmetered(net);

/** For the sync engine: may queued files be uploaded right now? */
export async function canUploadNow(fetchNet: () => Promise<NetLike> = NetInfo.fetch): Promise<boolean> {
  const wifiOnly = await getWifiOnly();
  if (!wifiOnly) return true;
  return uploadsAllowed(wifiOnly, await fetchNet().catch(() => null));
}

/** The setting for the Mazeed toggle. */
export function useWifiOnly(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(cached ?? false);
  useEffect(() => {
    listeners.add(setOn);
    void getWifiOnly().then(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return [on, (next: boolean) => void setWifiOnly(next)];
}

/** Test helper. */
export function resetWifiOnlyForTests() {
  cached = null;
  listeners.clear();
}
