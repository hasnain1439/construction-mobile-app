// getSentryExpoConfig = Expo's default config + Sentry debug ids in the bundle / source maps
// (matched to the maps uploaded at EAS build time). Harmless when Sentry is not configured.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname, { includeWebReplay: false, annotateReactComponents: false });
config.resolver.sourceExts.push('sql'); // drizzle migrations

module.exports = withNativeWind(config, { input: './global.css' });
