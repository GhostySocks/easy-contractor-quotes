import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, palettes, type Colors } from './theme';
import {
  DEFAULT_THEME_MODE,
  resolveScheme,
  useThemeStore,
  type ColorScheme,
  type ThemeMode,
} from './theme-store';

export type ThemeValue = {
  /** The palette for the scheme currently on screen. */
  colors: Colors;
  /** What is actually rendered right now. */
  scheme: ColorScheme;
  /** True when `scheme === 'dark'`. Handy for status bar / vendor props. */
  isDark: boolean;
  /** The user's stored preference (may be 'system'). */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Resolves the stored preference against the OS scheme and exposes the
 * matching palette. Mount once at the root, above navigation.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const system = useColorScheme();
  const scheme = resolveScheme(mode, system);

  const value = useMemo<ThemeValue>(
    () => ({ colors: palettes[scheme], scheme, isDark: scheme === 'dark', mode, setMode }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const FALLBACK: ThemeValue = {
  colors: darkColors,
  scheme: 'dark',
  isDark: true,
  mode: DEFAULT_THEME_MODE,
  setMode: () => {},
};

/** Active theme. Falls back to the dark palette when rendered without a provider (tests). */
export function useTheme(): ThemeValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

type StyleFactory<T> = (colors: Colors) => T;

// One StyleSheet per (factory, palette) pair for the whole app, so switching
// themes re-renders screens without re-creating identical sheets per mount.
const sheetCache = new WeakMap<StyleFactory<unknown>, WeakMap<Colors, unknown>>();

function resolveSheet<T>(make: StyleFactory<T>, colors: Colors): T {
  let perPalette = sheetCache.get(make as StyleFactory<unknown>);
  if (!perPalette) {
    perPalette = new WeakMap();
    sheetCache.set(make as StyleFactory<unknown>, perPalette);
  }
  let sheet = perPalette.get(colors) as T | undefined;
  if (sheet === undefined) {
    sheet = make(colors);
    perPalette.set(colors, sheet);
  }
  return sheet;
}

/**
 * Theme-aware replacement for a module-level `StyleSheet.create`.
 *
 *   const makeStyles = (colors: Colors) => StyleSheet.create({ ... });
 *   function Screen() {
 *     const styles = useStyles(makeStyles);
 *   }
 *
 * `makeStyles` must be a stable (module-level) function for the cache to hit.
 */
export function useStyles<T>(make: StyleFactory<T>): T {
  const { colors } = useTheme();
  return useMemo(() => resolveSheet(make, colors), [make, colors]);
}
