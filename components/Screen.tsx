import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/theme';
import { useRefresh } from '@/sync/triggers';
import { SyncBanner } from './SyncBanner';

const RAISED_FOOTER = { boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)' };

interface Props {
  children: ReactNode;
  header?: ReactNode;
  /** false for screens that render their own FlashList. */
  scroll?: boolean;
  /** Pull-to-refresh runs a sync. */
  refresh?: boolean;
  footer?: ReactNode;
  banner?: boolean;
  /** false when the header paints its own status-bar area (navy home header). */
  safeTop?: boolean;
}

export function Screen({ children, header, scroll = true, refresh = true, footer, banner = true, safeTop = true }: Props) {
  const { refreshing, onRefresh } = useRefresh();
  return (
    <SafeAreaView edges={safeTop ? ['top', 'left', 'right'] : ['left', 'right']} className="flex-1 bg-bg">
      {header}
      {banner ? <SyncBanner /> : null}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 p-4 pb-24"
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {footer ? (
        <View className="border-t border-border bg-card p-4" style={RAISED_FOOTER}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
