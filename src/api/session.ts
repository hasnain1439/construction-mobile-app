/**
 * Tokens, the signed-in person and this install's device id live in SecureStore (Keystore /
 * Keychain) — never in SQLite or plain storage.
 */
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { uuidv7 } from '../lib/uuid';
import { APP_VERSION } from './config';
import type { Role } from '../lib/permissions';

const K = { access: 'auth.access', refresh: 'auth.refresh', user: 'auth.user', device: 'device.id' } as const;

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  tenantId: string;
  tenantName: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([SecureStore.getItemAsync(K.access), SecureStore.getItemAsync(K.refresh)]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function setTokens(t: Tokens) {
  await SecureStore.setItemAsync(K.access, t.accessToken);
  await SecureStore.setItemAsync(K.refresh, t.refreshToken);
}

export async function getUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(K.user);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export const setUser = (u: SessionUser) => SecureStore.setItemAsync(K.user, JSON.stringify(u));

export async function clearSession() {
  await Promise.all([SecureStore.deleteItemAsync(K.access), SecureStore.deleteItemAsync(K.refresh), SecureStore.deleteItemAsync(K.user)]);
}

/** Stable id of this install (sent at login; the office can revoke it). */
export async function deviceInfo() {
  let id = await SecureStore.getItemAsync(K.device);
  if (!id) {
    id = `${Platform.OS}-${uuidv7()}`;
    await SecureStore.setItemAsync(K.device, id);
  }
  return {
    deviceId: id,
    platform: Platform.OS === 'ios' ? ('IOS' as const) : ('ANDROID' as const),
    model: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || undefined,
    appVersion: APP_VERSION,
  };
}

export const getDeviceId = () => SecureStore.getItemAsync(K.device);
