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
 * API_BASE_URL: set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example). A real phone can't
 * reach "localhost" — use your PC's Wi-Fi IP (`ipconfig` → IPv4 Address), e.g.
 * http://192.168.1.20:4000/api/v1. The Android emulator reaches the PC at 10.0.2.2.
 */
const config: ExpoConfig = {
  name: 'Munshi',
  slug: 'construction-mobile',
  scheme: 'munshi',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: false, bundleIdentifier: 'pk.construction.munshi' },
  android: {
    package: 'pk.construction.munshi',
    adaptiveIcon: {
      backgroundColor: '#2563EB',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Dev API over plain http on the LAN.
    usesCleartextTraffic: true,
    predictiveBackGestureEnabled: false,
  } as ExpoConfig['android'],
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    'expo-background-task',
    ['expo-audio', { microphonePermission: 'Voice note record karne ke liye mic chahiye.' }],
    ['expo-image-picker', { cameraPermission: 'Challan, slip aur site ki photo ke liye camera chahiye.', photosPermission: 'Photo chunne ke liye gallery chahiye.' }],
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#0F1E3D', imageWidth: 160 }],
    ...sentryPlugin, // see above: only with SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:4000/api/v1',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
