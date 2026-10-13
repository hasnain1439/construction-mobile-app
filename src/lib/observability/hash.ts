import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

/**
 * The only user identifier sent to Sentry / PostHog (same rule in the API and web app):
 * lowercase hex SHA-256 of `"user:" + userId`, first 32 characters. Never the raw id, name or phone.
 */
export async function hashUserId(userId: string): Promise<string> {
  const hex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `user:${userId}`);
  return hex.toLowerCase().slice(0, 32);
}
