/* Native modules replaced for jest (node). */
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)),
  randomUUID: () => require('node:crypto').randomUUID(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (algorithm: string, data: string) => {
    if (algorithm !== 'SHA-256') throw new Error(`unsupported ${algorithm}`);
    return require('node:crypto').createHash('sha256').update(data, 'utf8').digest('hex') as string;
  },
}));

// Crash reporting: never initialised in tests (and the native module isn't available).
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((c: unknown) => c),
  captureException: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
    __store: store,
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => undefined, fetch: async () => ({ isConnected: true, isInternetReachable: true }) },
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));
