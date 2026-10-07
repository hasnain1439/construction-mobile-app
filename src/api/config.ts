import Constants from 'expo-constants';

/** …/api/v1 — from EXPO_PUBLIC_API_BASE_URL (see .env.example). */
export const API_BASE_URL: string = (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://10.0.2.2:4000/api/v1';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
