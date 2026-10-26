import * as Crypto from 'expo-crypto';

/** Sent on every request; live updates skip the echo of this app's own writes (sync/live.ts). */
export const CLIENT_ID_HEADER = 'x-client-id';

/** Random id of this app start (8–64 of A–Z a–z 0–9 _ -, as the API expects). */
export const CLIENT_ID: string = `m${Array.from(Crypto.getRandomBytes(12), (b) => b.toString(36).padStart(2, '0')).join('')}`.slice(0, 24);
