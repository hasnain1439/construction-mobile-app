/** The three server calls the sync engine needs — an interface so tests can fake the server. */
import { File } from 'expo-file-system';
import { request } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { Row } from '../db/store';

export interface PullResponse {
  cursor: string;
  hasMore: boolean;
  resetRequired: boolean;
  serverTime: string;
  changes: Record<string, { upserts: Row[]; deletes: string[] }>;
}

export interface PushMutation {
  clientId: string;
  type: string;
  payload: Record<string, unknown>;
  deviceCreatedAt: string;
  dependsOn?: string[];
}

export type PushStatus = 'APPLIED' | 'DUPLICATE' | 'REJECTED' | 'RETRY';
export interface PushResult {
  clientId: string;
  type: string;
  status: PushStatus;
  serverId: string | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export interface UploadItem {
  clientId: string;
  localUri: string;
  kind: string;
  mimeType: string;
}

export interface SyncApi {
  pull(cursor: string | undefined): Promise<PullResponse>;
  push(mutations: PushMutation[], pendingOnPhone: number, deviceId?: string): Promise<{ results: PushResult[] }>;
  upload(item: UploadItem): Promise<{ id: string }>;
}

export const httpSyncApi: SyncApi = {
  pull: (cursor) => request<PullResponse>(ENDPOINTS.syncPull, { query: { cursor, limit: 500 } }),
  push: (mutations, pendingOnPhone, deviceId) =>
    request(ENDPOINTS.syncPush, { method: 'POST', body: { deviceId, mutations }, headers: { 'X-Pending-Mutations': String(pendingOnPhone) } }),
  upload: (item) => {
    const form = new FormData();
    form.append('kind', item.kind);
    form.append('clientId', item.clientId);
    const ext = item.mimeType === 'image/jpeg' ? 'jpg' : item.mimeType.split('/')[1] ?? 'bin';
    // Expo's fetch (SDK 52+) rejects React Native's old { uri, name, type } part ("Unsupported
    // FormDataPart implementation"); it accepts any part with name, type and bytes().
    const file = new File(item.localUri);
    form.append('file', { name: `${item.clientId}.${ext}`, type: item.mimeType, bytes: () => file.bytes() } as unknown as Blob);
    return request<{ id: string }>(ENDPOINTS.attachments, { method: 'POST', form });
  },
};
