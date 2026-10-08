import { httpSyncApi } from '../src/sync/api';

jest.mock('expo-file-system', () => ({
  File: class {
    bytes() {
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    }
  },
}));

describe('attachment upload', () => {
  it('sends a file part Expo fetch accepts (name, type, bytes) — not the old { uri } part', async () => {
    const append = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    const realFetch = global.fetch;
    global.fetch = (async () => {
      return new Response(JSON.stringify({ success: true, data: { id: 'a1' } }), { status: 201 });
    }) as typeof fetch;
    try {
      await expect(httpSyncApi.upload({ clientId: 'c1', kind: 'PURCHASE_PHOTO', localUri: 'file:///x/c1.jpg', mimeType: 'image/jpeg' } as never)).resolves.toEqual({ id: 'a1' });
    } finally {
      global.fetch = realFetch;
    }
    const part = append.mock.calls.find(([k]) => k === 'file')?.[1];
    append.mockRestore();
    expect(part).toMatchObject({ name: 'c1.jpg', type: 'image/jpeg' });
    expect(part).not.toHaveProperty('uri');
    await expect((part as { bytes: () => Promise<Uint8Array> }).bytes()).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });
});
