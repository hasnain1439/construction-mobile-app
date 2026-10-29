import type { ExpoConfig } from 'expo/config';

/**
 * Sentry config plugin (source-map upload during native builds) only when the build has
 * SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT (EAS secrets — never commit the token). Without
 * them the plugin is left out so local / CI builds don't fail on the upload step; the SDK itself
 * still works (it is autolinked) and stays off at runtime unless EXPO_PUBLIC_SENTRY_DSN is set.
 */
const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
const sentryPlugin: NonNullable<ExpoConfig['plugins']> = sentryUpload
  ? [['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, url: process.env.SENTRY_URL || 'https://sentry.io/' }]]
  : [];

/**
 * Build variants (APP_VARIANT, set per profile in eas.json) install side by side on one phone:
 *   development → "Keystone Munshi Dev",   pk.construction.munshi.dev      (dev client, channel development)
 *   preview     → "Keystone Munshi Pilot", pk.construction.munshi.preview  (pilot APK, channel preview)
 *   production  → "Keystone Munshi",       pk.construction.munshi          (Play Store AAB, channel production)
 * No APP_VARIANT (local `expo start` / `expo run:android`) = development.
 * Only the display name carries the Keystone brand: bundle id / package, slug, scheme and the EAS
 * project stay as they are (changing them would make a new app and break OTA updates).
 */
export type AppVariant = 'development' | 'preview' | 'production';
const VARIANT: AppVariant = (['development', 'preview', 'production'] as const).find((v) => v === process.env.APP_VARIANT) ?? 'development';
const BASE_ID = 'pk.construction.munshi';
const VARIANTS: Record<AppVariant, { name: string; id: string; scheme: string }> = {
  development: { name: 'Keystone Munshi Dev', id: `${BASE_ID}.dev`, scheme: 'munshi-dev' },
  preview: { name: 'Keystone Munshi Pilot', id: `${BASE_ID}.preview`, scheme: 'munshi-preview' },
  production: { name: 'Keystone Munshi', id: BASE_ID, scheme: 'munshi' },
};
const variant = VARIANTS[VARIANT];

/**
 * EAS project id: run `npx eas init` once (Expo account), then paste the id it prints here or set
 * EAS_PROJECT_ID (EAS environment variable + your shell). Without it OTA updates stay off.
 */
const EAS_PROJECT_ID_FROM_INIT = '';
const projectId = process.env.EAS_PROJECT_ID || EAS_PROJECT_ID_FROM_INIT || undefined;

/**
 * Version scheme (docs/RELEASE.md): `version` is semver and the only number people bump.
 * runtimeVersion follows it (policy appVersion): an OTA update only reaches builds with the same
 * version, so bump it for every native change. Android versionCode is kept by EAS (remote +
 * autoIncrement in eas.json), never here.
 */
const VERSION = '1.0.0';

/**
 * API_BASE_URL: set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example) or per profile in
 * eas.json. A real phone can't reach "localhost" — use your PC's Wi-Fi IP (`ipconfig` → IPv4
 * Address), e.g. http://192.168.1.20:4000/api/v1. The Android emulator reaches the PC at 10.0.2.2.
 */
const config: ExpoConfig = {
  name: variant.name,
  slug: 'construction-mobile',
  scheme: variant.scheme,
  version: VERSION,
  runtimeVersion: { policy: 'appVersion' },
  updates: projectId
    ? {
        url: `https://u.expo.dev/${projectId}`,
        enabled: true,
        // Checked on every cold start; the download finishes in the background and is used on the next start.
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
      }
    : { enabled: false },
  orientation: 'portrait',
  // Keystone artwork: every PNG below comes from the master SVGs in assets/brand/ via scripts/generate-icons.mjs.
  // 1024 charcoal square with the dark-variant mark, no rounded corners / transparency (iOS applies its own mask).
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: false, bundleIdentifier: variant.id },
  android: {
    package: variant.id,
    adaptiveIcon: {
      // Charcoal background, dark-variant mark inside the 66 dp safe zone, white mark for themed icons.
      backgroundColor: '#201F1E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Plain http to a dev API on the LAN only in development builds; pilot and store builds need HTTPS.
    usesCleartextTraffic: VARIANT === 'development',
    predictiveBackGestureEnabled: false,
  } as ExpoConfig['android'],
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    'expo-background-task',
    'expo-updates',
    ['expo-audio', { microphonePermission: 'Voice note record karne ke liye mic chahiye.' }],
    ['expo-image-picker', { cameraPermission: 'Challan, slip aur site ki photo ke liye camera chahiye.', photosPermission: 'Photo chunne ke liye gallery chahiye.' }],
    'expo-font',
    // Charcoal with the dark-variant mark centred (1024 transparent PNG).
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#201F1E', imageWidth: 180 }],
    // No push notifications yet (expo-notifications is not installed). When it is added, wire the white
    // monochrome mark: ['expo-notifications', { icon: './assets/notification-icon.png', color: '#201F1E' }].
    ...sentryPlugin, // see above: only with SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:4000/api/v1',
    appVariant: VARIANT,
    eas: { projectId },
  },
};

export default config;
