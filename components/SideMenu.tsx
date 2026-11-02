import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '@/features/access';
import { groupOf, menuFor } from '@/features/menu';
import { useUser } from '@/features/session';
import { roleLabel, useI18n } from '@/i18n';
import { COLORS } from '@/lib/theme';
import { BrandLogo } from './BrandLogo';
import { Icon } from './Icon';

const MenuCtx = createContext<{ open: () => void } | null>(null);

const WIDTH = 300;

/** The side menu: the main parts; tapping one with more screens opens them. Only what this role may open (src/features/menu.ts). */
function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, language, rtl } = useI18n();
  const p = usePermissions();
  const user = useUser();
  const pathname = usePathname();
  const groups = useMemo(() => menuFor(p.access, p.role), [p.access, p.role]);
  // Main options first; the part holding the open screen starts opened.
  const [openKey, setOpenKey] = useState<string | null>(() => groupOf(groups, pathname));
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
              <View className="mb-2">
                <BrandLogo variant="small" />
              </View>
              <Text className="font-bold text-lg text-ink" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {roleLabel(language, user.role, p.access?.permissionRole)}
              </Text>
            </View>
            <ScrollView testID="side-menu" contentContainerClassName="gap-1 px-3 py-4">
              {groups.map((g) => {
                const hasSub = g.items.length > 0;
                const isOpen = openKey === g.key;
                const here = g.href === pathname || g.items.some((i) => i.href === pathname);
                return (
                  <View key={g.key}>
                    <Pressable
                      testID={`menu-group-${g.key}`}
                      accessibilityRole="button"
                      accessibilityState={hasSub ? { expanded: isOpen } : { selected: here }}
                      onPress={() => (hasSub ? setOpenKey(isOpen ? null : g.key) : go(g.href!))}
                      className={`min-h-12 flex-row items-center gap-3 rounded-xl px-3 ${here ? 'bg-primary/10' : 'active:bg-bg'}`}
                    >
                      <Icon name={g.icon} size={22} color={here ? COLORS.primary : COLORS.ink} />
                      <Text className={`flex-1 text-base ${here ? 'font-semibold text-primary' : 'font-medium text-ink'}`}>{t(g.title)}</Text>
                      {hasSub ? <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.muted} /> : null}
                    </Pressable>
                    {hasSub && isOpen ? (
                      <View testID={`menu-sub-${g.key}`} className="gap-0.5 py-1 ps-6">
                        {[...(g.href ? [{ key: g.href, href: g.href, label: g.title, icon: 'view-dashboard-outline' }] : []), ...g.items].map((i) => {
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
                              <Icon name={i.icon} size={18} color={active ? COLORS.primary : COLORS.muted} />
                              <Text className={`flex-1 text-[15px] ${active ? 'font-semibold text-primary' : 'text-ink'}`}>{t(i.label)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
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
