/**
 * Design tokens for Easy Contractor Quotes.
 * Source of truth: CLAUDE.md §4. Do not hardcode hex values elsewhere.
 */

export const colors = {
  gold: '#D4AF37',
  goldDark: '#A88828',
  goldTint: '#FBF4D9',
  ink: '#1A1A1A',
  ink2: '#4A4A4A',
  ink3: '#8A8A8A',
  surface: '#FFFFFF',
  surface2: '#F7F5EF',
  divider: '#E8E4D7',
  success: '#0A7E3A',
  warn: '#C88A00',
  danger: '#B3261E',
  sky: '#E6F0FA',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Minimum body size is 18pt per CLAUDE.md §4 (contractors work outdoors, often 35-55).
 * Minimum touch targets are 60pt — no exceptions.
 */
export const typography = {
  fonts: {
    display: 'InterTight_700Bold',
    displayHeavy: 'InterTight_800ExtraBold',
    body: 'Inter_500Medium',
    bodyStrong: 'Inter_600SemiBold',
    numeric: 'Inter_700Bold',
  },
  sizes: {
    display: 32,
    h1: 28,
    h2: 22,
    h3: 18,
    body: 18,
    bodySmall: 15,
    label: 11,
  },
  minTouchTarget: 60,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  fab: 32,
  pill: 999,
} as const;

export const motion = {
  curves: {
    standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    easeInOut: 'ease-in-out',
  },
  durations: {
    standard: 250,
    screenPush: 350,
    paywallReveal: 450,
    splashShimmer: 1200,
  },
  fabPress: {
    stiffness: 320,
    damping: 22,
  },
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  radii,
  motion,
} as const;

export type Theme = typeof theme;
