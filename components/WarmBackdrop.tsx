import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/**
 * The web app's warm page background: a sand haze from the top-right fading into sunlight
 * at the bottom-left, over the base colour. Purely decorative (no touches).
 */
export function WarmBackdrop() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(181, 161, 139, 0.20)', 'rgba(236, 233, 229, 0)', 'rgba(255, 207, 104, 0.32)']}
      locations={[0, 0.5, 1]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
