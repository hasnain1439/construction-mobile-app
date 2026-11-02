import * as SecureStore from 'expo-secure-store';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { applyPalette, paletteVariables, type Scheme } from './theme';

/** What the person chose in More → Theme: follow the phone, or always light / dark. */
export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'theme_mode';

const Ctx = createContext<{ mode: ThemeMode; scheme: Scheme; setMode: (m: ThemeMode) => void }>({ mode: 'system', scheme: 'light', setMode: () => undefined });

/**
 * Light / dark like the web dashboard. Sets the CSS variables every colour class reads and the raw
 * COLORS (icons, tab bar), then re-mounts the app under the new theme (a rare, deliberate switch).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    void SecureStore.getItemAsync(THEME_KEY).then(
      (v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      },
      () => undefined,
    );
  }, []);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void SecureStore.setItemAsync(THEME_KEY, m).catch(() => undefined);
  }, []);
  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  applyPalette(scheme);
  const style = useMemo(() => [{ flex: 1 }, vars(paletteVariables(scheme))], [scheme]);
  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);
  return (
    <Ctx.Provider value={value}>
      <View key={scheme} style={style}>
        {children}
      </View>
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
