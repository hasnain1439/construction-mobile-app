import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

const PHOTO = require('../assets/login-building.jpg');

/**
 * The web login's building photo (Unsplash licence) drifting slowly behind the content,
 * under a charcoal wash so white text stays readable. Still when "reduce motion" is on.
 */
export function BuildingHero({ children }: { children: ReactNode }) {
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 18000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 18000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [drift]);

  const transform = [
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.2] }) },
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
    { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
  ];

  return (
    <View className="overflow-hidden">
      <Animated.Image source={PHOTO} resizeMode="cover" style={[StyleSheet.absoluteFill, { transform }]} accessibilityIgnoresInvertColors />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(32, 31, 30, 0.85)', 'rgba(32, 31, 30, 0.45)', 'rgba(32, 31, 30, 0.9)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
