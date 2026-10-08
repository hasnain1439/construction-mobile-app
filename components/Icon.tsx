import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { COLORS } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Screens pass short emoji as icon ids (easy to read in code); they render as crisp vector
 * icons so the app looks consistent on every phone. Unknown values fall back to text.
 */
const EMOJI: Record<string, IconName> = {
  '🏗️': 'crane',
  '👷': 'account-hard-hat',
  '📝': 'clipboard-text-outline',
  '🚚': 'truck-delivery-outline',
  '💵': 'cash-multiple',
  '🗓️': 'calendar-check-outline',
  '🧱': 'wall',
  '🤝': 'handshake-outline',
  '📦': 'package-variant-closed',
  '✓': 'check',
  '✅': 'check-circle-outline',
  '🔒': 'lock-outline',
  '➕': 'plus',
  '📏': 'ruler',
  '💾': 'content-save-outline',
  '⏳': 'timer-sand',
  '🙏': 'hand-coin-outline',
  '🧾': 'receipt-text-outline',
  '📱': 'cellphone',
  '🛒': 'cart-outline',
  '🔢': 'counter',
  '📊': 'chart-box-outline',
  '📚': 'book-open-variant',
  '🔔': 'bell-outline',
  '⚠️': 'alert-outline',
  '⟳': 'sync',
  '🚪': 'logout',
  '🏠': 'home-variant-outline',
  '☰': 'menu',
  '▾': 'chevron-down',
  '›': 'chevron-right',
  '↩': 'undo',
  '☑️': 'checkbox-marked-outline',
  '⬜': 'checkbox-blank-outline',
  'ℹ️': 'information-outline',
  '☕': 'coffee-outline',
  '🛺': 'rickshaw',
  '⛽': 'gas-station-outline',
  '🔧': 'wrench-outline',
  '🛠️': 'tools',
  '📷': 'camera-outline',
  '🎙️': 'microphone-outline',
  '☀️': 'weather-sunny',
  '🌧️': 'weather-rainy',
  '🔌': 'power-plug-off-outline',
  '🚱': 'water-off-outline',
  '💧': 'water-outline',
  '🙈': 'eye-off-outline',
  '⬆️': 'arrow-up-circle-outline',
  '📭': 'inbox-outline',
  '🖼️': 'image-outline',
  '📍': 'map-marker-outline',
  '📴': 'wifi-off',
  '🔴': 'record-circle-outline',
  '⏹': 'stop',
  '⏸': 'pause',
  '▶️': 'play',
  '←': 'arrow-left',
  '→': 'arrow-right',
};

export function iconFor(value: string): IconName | null {
  if (value in EMOJI) return EMOJI[value]!;
  return value in MaterialCommunityIcons.glyphMap ? (value as IconName) : null;
}

interface Props {
  /** A MaterialCommunityIcons name or one of the emoji ids above. */
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color = COLORS.ink }: Props) {
  const icon = iconFor(name);
  if (!icon) return <Text style={{ fontSize: size * 0.9, color }}>{name}</Text>;
  return <MaterialCommunityIcons name={icon} size={size} color={color} />;
}

/** Leading "emoji " in a label becomes an icon; returns the icon id and the plain text. */
export function splitIcon(label: string): { icon: string | null; text: string } {
  const m = /^(\S+)\s+(.*)$/su.exec(label);
  if (m && iconFor(m[1]!)) return { icon: m[1]!, text: m[2]! };
  return { icon: null, text: label };
}
