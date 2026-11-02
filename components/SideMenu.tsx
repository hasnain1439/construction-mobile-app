import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '@/features/access';
import { menuFor } from '@/features/menu';
import { useUser } from '@/features/session';
import { roleLabel, useI18n } from '@/i18n';
import { COLORS } from '@/lib/theme';
import { Icon } from './Icon';

const MenuCtx = createContext<{ open: () => void } | null>(null);

const WIDTH = 300;

/** The side menu: every screen in groups, only what this role may open (src/features/menu.ts). */
function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, language, rtl } = useI18n();
  const p = usePermissions();
  const user = useUser();
  const pathname = usePathname();
  const groups = useMemo(() => menuFor(p.access, p.role), [p.access, p.role]);
  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible, slide]);
  const offset = slide.interpolate({ inputRange: [0, 1], outputRange: [rtl ? WIDTH : -WIDTH, 0] });
  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className={`flex-1 ${rtl ? 'flex-row-reverse' : 'flex-row'}`}>
        <Animated.View style={{ width: WIDTH, transform: [{ translateX: offset }] }} className="bg-card">
          <SafeAreaView edges={['top', 'bottom', rtl ? 'right' : 'left']} className="flex-1">
            <View className="gap-1 border-b border-border px-5 pb-4 pt-3">
              <Text className="font-bold text-lg text-ink" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {roleLabel(language, user.role, p.access?.permissionRole)}
              </Text>
            </View>
            <ScrollView testID="side-menu" contentContainerClassName="gap-4 px-3 py-4">
              {groups.map((g) => (
                <View key={g.title} className="gap-1">
                  <Text className="px-2 text-xs font-semibold uppercase text-muted">{t(g.title)}</Text>
                  {g.items.map((i) => {
                    const active = pathname === i.href;
                    return (
                      <Pressable
                        key={i.key}
                        testID={`menu-${i.href}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => go(i.href)}
                        className={`min-h-11 flex-row items-center gap-3 rounded-xl px-3 ${active ? 'bg-primary/10' : 'active:bg-bg'}`}
                      >
                        <Icon name={i.icon} size={20} color={active ? COLORS.primary : COLORS.muted} />
                        <Text className={`flex-1 text-base ${active ? 'font-semibold text-primary' : 'text-ink'}`}>{t(i.label)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
        <Pressable testID="side-menu-backdrop" accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} className="flex-1 bg-black/40" />
      </View>
    </Modal>
  );
}

/** Puts the side menu under the signed-in app; `MenuButton` opens it. */
export function SideMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <MenuCtx.Provider value={value}>
      {children}
      {visible ? <Drawer visible={visible} onClose={() => setVisible(false)} /> : null}
    </MenuCtx.Provider>
  );
}

/** ☰ — opens the side menu (nothing outside the signed-in app). */
export function MenuButton() {
  const { t } = useI18n();
  const ctx = useContext(MenuCtx);
  if (!ctx) return null;
  return (
    <Pressable testID="menu-button" accessibilityRole="button" accessibilityLabel={t('menu.open')} onPress={ctx.open} className="h-11 w-11 items-center justify-center rounded-full bg-bg active:bg-border">
      <Icon name="menu" size={22} color={COLORS.ink} />
    </Pressable>
  );
}
