/** Photo compression before upload (src/features/media.ts): resize to 1280 px, JPEG quality 0.6, then queue. */
import { attachmentsQueue } from '../src/db/schema';
import { JPEG_QUALITY, MAX_SIDE, takePhoto } from '../src/features/media';
import { testDb } from './helpers/db';

const mockDb = testDb();
const mockResize = jest.fn();
const mockSave = jest.fn(async (_opts: unknown) => ({ uri: 'file:///cache/manipulated.jpg', width: 1280, height: 960 }));
const mockMove = jest.fn(async () => undefined);
let mockAsset = { uri: 'file:///camera/big.jpg', width: 4000, height: 3000 };

jest.mock('../src/db/client', () => ({ getDb: () => mockDb }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: false, assets: [mockAsset] }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [mockAsset] }),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: (s: unknown) => mockResize(s),
      renderAsync: async () => ({ saveAsync: (o: unknown) => mockSave(o) }),
    }),
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc' },
  Directory: class {
    exists = true;
    uri = 'file:///doc/attachments';
    create() {}
  },
  File: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    move() {
      return mockMove();
    }
  },
}));

beforeEach(() => {
  mockResize.mockClear();
  mockSave.mockClear();
});

describe('photo compression', () => {
  it('a large camera photo is resized to 1280 px and saved as JPEG at quality 0.6, then queued', async () => {
    const id = await takePhoto('camera', 'RECEIPT');
    expect(mockResize).toHaveBeenCalledWith({ width: MAX_SIDE });
    expect(mockSave).toHaveBeenCalledWith({ compress: JPEG_QUALITY, format: 'jpeg' });
    expect(JPEG_QUALITY).toBeLessThanOrEqual(0.7);
    const row = mockDb
      .select()
      .from(attachmentsQueue)
      .all()
      .find((r) => r.clientId === id)!;
    expect(row).toMatchObject({ kind: 'RECEIPT', mimeType: 'image/jpeg', status: 'PENDING' });
    expect(row.localUri).toMatch(/^file:\/\/\/doc\/attachments\/.+\.jpg$/);
  });

  it('a small gallery photo is not upscaled but is still re-encoded', async () => {
    mockAsset = { uri: 'file:///gallery/small.jpg', width: 900, height: 1200 };
    await takePhoto('gallery', 'SITE_PHOTO');
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith({ compress: JPEG_QUALITY, format: 'jpeg' });
  });
});
