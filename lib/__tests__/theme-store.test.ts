import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, type ColorToken } from '../theme';
import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  resolveScheme,
  useThemeStore,
} from '../theme-store';

describe('theme preference store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useThemeStore.setState({ mode: DEFAULT_THEME_MODE });
  });

  it('defaults to dark', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('persists the chosen mode to AsyncStorage', async () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');

    // zustand/persist writes synchronously into the storage adapter, which
    // for AsyncStorage resolves on the next tick.
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.mode).toBe('light');
  });

  it('rehydrates a stored preference on the next launch', async () => {
    await AsyncStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'system' }, version: 1 }),
    );
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('ignores a corrupt stored value and keeps the default', async () => {
    await AsyncStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'sepia' }, version: 1 }),
    );
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});

describe('resolveScheme', () => {
  it('honours an explicit light / dark choice regardless of the OS', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('follows the OS when set to system, falling back to dark when unknown', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', undefined)).toBe('dark');
  });
});

describe('palettes', () => {
  it('keep gold identical in both modes (CLAUDE.md §4)', () => {
    expect(darkColors.gold).toBe(lightColors.gold);
    expect(darkColors.gold).toBe('#D4AF37');
  });

  it('define every token in both palettes', () => {
    const tokens = Object.keys(lightColors) as ColorToken[];
    for (const token of tokens) {
      expect(typeof darkColors[token]).toBe('string');
      expect(darkColors[token].length).toBeGreaterThan(0);
    }
  });

  it('clear WCAG AA (4.5:1) for text tokens on dark surfaces', () => {
    const text: ColorToken[] = ['ink', 'ink2', 'ink3', 'goldDark', 'success', 'warn', 'danger'];
    for (const bg of ['surface', 'surface2'] as const) {
      for (const token of text) {
        expect(contrast(darkColors[token], darkColors[bg])).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(darkColors.onGold, darkColors.gold)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors.goldDark, darkColors.goldTint)).toBeGreaterThanOrEqual(4.5);
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
