import { createContext, useContext, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/theme';
import { useRefresh } from '@/sync/triggers';
import { SyncBanner } from './SyncBanner';

const RAISED_FOOTER = { boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)' };

/**
 * True inside the tab screens: there the tab bar already sits above the phone's gesture bar / buttons.
 * Every other screen keeps its last content and footer buttons clear of them itself.
 */
export const InTabsContext = createContext(false);

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

/** A plain page (the web dashboard's flat background, no gradient) with header, sync banner and footer. */
export function Screen({ children, header, scroll = true, refresh = true, footer, banner = true, safeTop = true }: Props) {
  const { refreshing, onRefresh } = useRefresh();
  const inTabs = useContext(InTabsContext);
  // Space for the phone's gesture bar / 3 buttons (edge-to-edge Android, iPhone home bar).
  // Null without a SafeAreaProvider (some tests): then no extra space.
  const insets = useContext(SafeAreaInsetsContext);
  const bottom = inTabs ? 0 : (insets?.bottom ?? 0);
  return (
    <SafeAreaView edges={safeTop ? ['top', 'left', 'right'] : ['left', 'right']} className="flex-1 bg-bg">
      {header}
      {banner ? <SyncBanner /> : null}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 p-4"
          contentContainerStyle={{ paddingBottom: (footer ? 24 : 96) + (footer ? 0 : bottom) }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1" style={footer ? undefined : { paddingBottom: bottom }}>
          {children}
        </View>
      )}
      {footer ? (
        <View className="border-t border-border bg-card px-4 pt-4" style={[RAISED_FOOTER, { paddingBottom: 16 + bottom }]}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
