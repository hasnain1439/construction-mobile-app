import { Image, Text, View } from 'react-native';
import { BRAND_NAME } from '@/lib/brand';

// PNGs rendered from the master SVGs (assets/brand/*.svg) by scripts/generate-icons.mjs; Metro picks @2x / @3x.
const MARK_DARK = require('../assets/brand/keystone-mark-dark.png');
const MARK_SMALL = require('../assets/brand/keystone-mark-small.png');

type Props = {
  /** `onDark`: big mark + white wordmark (login hero, charcoal). `small`: ≤ 32 px mark + ink wordmark (light screens). */
  variant: 'onDark' | 'small';
  testID?: string;
};

/**
 * Keystone mark + wordmark (Cabin 700, letter-spacing −0.5). The brand name is never translated and
 * stays Latin, left-to-right, in the Urdu UI too.
 */
export function BrandLogo({ variant, testID }: Props) {
  const onDark = variant === 'onDark';
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_NAME}
      className={onDark ? 'items-center gap-3' : 'flex-row items-center gap-2'}
      style={{ direction: 'ltr' }}
    >
      <Image source={onDark ? MARK_DARK : MARK_SMALL} style={onDark ? { width: 72, height: 72 } : { width: 28, height: 28 }} resizeMode="contain" />
      <Text
        className={onDark ? 'text-4xl text-white' : 'text-xl text-ink'}
        style={{ fontFamily: 'Cabin_700Bold', letterSpacing: -0.5, writingDirection: 'ltr' }}
      >
        {BRAND_NAME}
      </Text>
    </View>
  );
}
