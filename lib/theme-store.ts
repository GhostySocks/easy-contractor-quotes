import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ColorSchemeName } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * User-facing appearance preference.
 *   'dark'   — the default; deep blacks, warm greys, gold accents
 *   'light'  — the original light palette
 *   'system' — follow the OS setting (useColorScheme)
 */
export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';
export const THEME_STORAGE_KEY = 'ecq.theme-mode';

export type ThemeStore = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Resolve a preference + OS scheme into the scheme we actually render. */
export function resolveScheme(mode: ThemeMode, system: ColorSchemeName): ColorScheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

/**
 * Persisted appearance preference. Lives in AsyncStorage (not SecureStore —
 * it is not sensitive, and we want it available as early as possible so the
 * first painted frame already uses the right palette).
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: DEFAULT_THEME_MODE,
      setMode: (mode) => set({ mode: isThemeMode(mode) ? mode : DEFAULT_THEME_MODE }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<ThemeStore> | undefined)?.mode;
        return { ...current, mode: isThemeMode(saved) ? saved : current.mode };
      },
    },
  ),
);
