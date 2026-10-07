import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRefresh } from '@/sync/triggers';
import { SyncBanner } from './SyncBanner';

interface Props {
  children: ReactNode;
  header?: ReactNode;
  /** false for screens that render their own FlashList. */
  scroll?: boolean;
  /** Pull-to-refresh runs a sync. */
  refresh?: boolean;
  footer?: ReactNode;
  banner?: boolean;
}

export function Screen({ children, header, scroll = true, refresh = true, footer, banner = true }: Props) {
  const { refreshing, onRefresh } = useRefresh();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg">
      {header}
      {banner ? <SyncBanner /> : null}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 p-4 pb-24"
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {footer ? <View className="border-t border-border bg-card p-4">{footer}</View> : null}
    </SafeAreaView>
  );
}
