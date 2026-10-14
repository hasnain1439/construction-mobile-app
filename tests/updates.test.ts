import { quietUpdateCheck, resetUpdateCheckForTests, shouldCheckForUpdate, UPDATE_CHECK_EVERY_MS, versionLabel, type UpdatesApi } from '../src/lib/updates';

jest.mock('expo-updates', () => ({ isEnabled: false, channel: null, updateId: null, isEmbeddedLaunch: true }));

function fakeUpdates(over: Partial<UpdatesApi> = {}) {
  return {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
    ...over,
  };
}

beforeEach(() => resetUpdateCheckForTests());

describe('quiet OTA update check', () => {
  it('checks again only after 6 hours', () => {
    expect(shouldCheckForUpdate(null, 0)).toBe(true);
    expect(shouldCheckForUpdate(0, UPDATE_CHECK_EVERY_MS - 1)).toBe(false);
    expect(shouldCheckForUpdate(0, UPDATE_CHECK_EVERY_MS)).toBe(true);
  });

  it('downloads an available update (used on the next start, no reload)', async () => {
    const api = fakeUpdates();
    expect(await quietUpdateCheck(api, 1000, false)).toBe('downloaded');
    expect(api.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(await quietUpdateCheck(api, 2000, false)).toBe('too-soon');
    expect(await quietUpdateCheck(api, 1000 + UPDATE_CHECK_EVERY_MS, false)).toBe('downloaded');
  });

  it('does nothing in dev / Expo Go or when updates are off', async () => {
    const api = fakeUpdates();
    expect(await quietUpdateCheck(api, 0, true)).toBe('disabled');
    expect(await quietUpdateCheck({ ...api, isEnabled: false }, 0, false)).toBe('disabled');
    expect(api.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('no update → nothing fetched; offline errors are swallowed', async () => {
    const none = fakeUpdates({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    expect(await quietUpdateCheck(none, 0, false)).toBe('none');
    expect(none.fetchUpdateAsync).not.toHaveBeenCalled();
    resetUpdateCheckForTests();
    const offline = fakeUpdates({ checkForUpdateAsync: jest.fn(async () => Promise.reject(new Error('Network request failed'))) });
    expect(await quietUpdateCheck(offline, 0, false)).toBe('error');
  });

  it('two checks at the same time share one request', async () => {
    const api = fakeUpdates();
    const [a, b] = await Promise.all([quietUpdateCheck(api, 0, false), quietUpdateCheck(api, 0, false)]);
    expect([a, b]).toEqual(['downloaded', 'downloaded']);
    expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });
});

describe('version label (Mazeed footer, for support)', () => {
  it('shows the channel and the OTA update id when running one', () => {
    expect(versionLabel('1.0.0', { isEnabled: false, channel: null, updateId: null, isEmbeddedLaunch: true })).toBe('1.0.0');
    expect(versionLabel('1.0.0', { isEnabled: true, channel: 'preview', updateId: '0193ab12-aaaa', isEmbeddedLaunch: true })).toBe('1.0.0 (preview)');
    expect(versionLabel('1.0.0', { isEnabled: true, channel: 'preview', updateId: '0193ab12-aaaa', isEmbeddedLaunch: false })).toBe('1.0.0 (preview · 0193ab12)');
    expect(versionLabel('1.0.0')).toBe('1.0.0'); // jest: expo-updates disabled
  });
});
