/* Native modules replaced for jest (node). */
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)),
  randomUUID: () => require('node:crypto').randomUUID(),
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
