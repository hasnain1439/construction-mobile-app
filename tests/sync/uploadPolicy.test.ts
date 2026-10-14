import * as SecureStore from 'expo-secure-store';
import { attachmentsQueue, outbox } from '../../src/db/schema';
import { queueAttachment } from '../../src/sync/attachments';
import { resetEngineForTests, syncNow } from '../../src/sync/engine';
import { enqueue } from '../../src/sync/outbox';
import { canUploadNow, getWifiOnly, isUnmetered, resetWifiOnlyForTests, setWifiOnly, uploadsAllowed, WIFI_ONLY_KEY } from '../../src/sync/uploadPolicy';
import { testDb } from '../helpers/db';
import { FakeApi } from '../helpers/fakeApi';

const WIFI = { type: 'wifi', isConnected: true };
const CELL = { type: 'cellular', isConnected: true };

beforeEach(async () => {
  resetEngineForTests();
  resetWifiOnlyForTests();
  await SecureStore.deleteItemAsync(WIFI_ONLY_KEY);
});

describe('"Wi-Fi only" upload policy', () => {
  it('Wi-Fi and cable count as unmetered; mobile data, unknown and offline do not', () => {
    expect(isUnmetered(WIFI)).toBe(true);
    expect(isUnmetered({ type: 'ethernet', isConnected: true })).toBe(true);
    expect(isUnmetered(CELL)).toBe(false);
    expect(isUnmetered({ type: 'unknown', isConnected: true })).toBe(false);
    expect(isUnmetered({ type: 'wifi', isConnected: false })).toBe(false);
    expect(isUnmetered(null)).toBe(false);
  });

  it('setting off: uploads go on any network; on: only on Wi-Fi', () => {
    expect(uploadsAllowed(false, CELL)).toBe(true);
    expect(uploadsAllowed(false, null)).toBe(true);
    expect(uploadsAllowed(true, CELL)).toBe(false);
    expect(uploadsAllowed(true, WIFI)).toBe(true);
  });

  it('is off by default and is kept on the phone (SecureStore)', async () => {
    expect(await getWifiOnly()).toBe(false);
    await setWifiOnly(true);
    expect(await SecureStore.getItemAsync(WIFI_ONLY_KEY)).toBe('1');
    resetWifiOnlyForTests();
    expect(await getWifiOnly()).toBe(true);
  });

  it('canUploadNow asks the network only when the setting is on', async () => {
    const fetchNet = jest.fn(async () => CELL);
    expect(await canUploadNow(fetchNet)).toBe(true);
    expect(fetchNet).not.toHaveBeenCalled();
    await setWifiOnly(true);
    expect(await canUploadNow(fetchNet)).toBe(false);
    expect(await canUploadNow(async () => WIFI)).toBe(true);
    expect(await canUploadNow(async () => Promise.reject(new Error('no netinfo')))).toBe(false);
  });
});

describe('sync with uploads deferred (mobile data + Wi-Fi only)', () => {
  function setup() {
    const db = testDb();
    enqueue(db, { clientId: 'h1', type: 'ATTENDANCE_UPSERT', payload: { workerId: 'w1' }, label: 'Hazri' });
    const photo = queueAttachment(db, { localUri: 'file:///slip.jpg', kind: 'RECEIPT', mimeType: 'image/jpeg' });
    enqueue(db, { clientId: 'k1', type: 'CASH_EXPENSE_CREATE', payload: { amountPaisa: '50000', attachmentId: photo }, label: 'Kharcha' });
    enqueue(db, { clientId: 'h2', type: 'ATTENDANCE_UPSERT', payload: { workerId: 'w2' }, label: 'Hazri' });
    return { db, photo };
  }

  it('keeps the photo and the entry that needs it (and what follows, to keep the order); sends what came before', async () => {
    const { db } = setup();
    const api = new FakeApi();
    const st = await syncNow(db, api, { canUpload: async () => false });
    expect(api.uploads).toHaveLength(0);
    expect(api.pushed.flat().map((m) => m.clientId)).toEqual(['h1']);
    expect(st).toMatchObject({ phase: 'idle', pendingUploads: 1, pending: 2, uploadsDeferred: true });
    expect(
      db
        .select()
        .from(outbox)
        .all()
        .map((o) => [o.clientId, o.status]),
    ).toEqual([
      ['h1', 'APPLIED'],
      ['k1', 'PENDING'],
      ['h2', 'PENDING'],
    ]);
  });

  it('on Wi-Fi the photo goes first, then every entry', async () => {
    const { db, photo } = setup();
    const api = new FakeApi();
    await syncNow(db, api, { canUpload: async () => false });
    const st = await syncNow(db, api, { canUpload: async () => true });
    expect(api.uploads.map((u) => u.clientId)).toEqual([photo]);
    expect(api.pushed.flat().map((m) => m.clientId)).toEqual(['h1', 'k1', 'h2']);
    expect(st).toMatchObject({ pending: 0, pendingUploads: 0, uploadsDeferred: false });
    expect(db.select().from(attachmentsQueue).get()!.status).toBe('UPLOADED');
  });

  it('without a policy (logout, tests) everything is uploaded as before', async () => {
    const { db } = setup();
    const api = new FakeApi();
    const st = await syncNow(db, api);
    expect(api.uploads).toHaveLength(1);
    expect(st.uploadsDeferred).toBe(false);
    expect(st.pending).toBe(0);
  });
});
