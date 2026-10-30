/**
 * Design tokens for Easy Contractor Quotes.
 * Source of truth: CLAUDE.md §4. Do not hardcode hex values elsewhere.
 *
 * Colors come in two palettes. Per §4, dark mode inverts the ink/surface
 * pairs and keeps gold identical. Screens never import a palette directly —
 * they read the active one through `useTheme()` / `useStyles()` from
 * `@/lib/theme-context`.
 */

/** Light palette — the §4 table verbatim, plus a few semantic helpers. */
export const lightColors = {
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

  // --- Semantic helpers (same in both modes unless noted) -------------------
  /** Lighter gold for gradients / shimmer highlights. */
  goldLight: '#F2CD5B',
  /** Text and glyphs sitting on a solid gold fill. Always dark: gold is a light color. */
  onGold: '#1A1A1A',
  /** Background of an "inverted" hero block (dark card, selected day, banner). */
  inverseSurface: '#1A1A1A',
  /** Primary text on `inverseSurface`. */
  onInverse: '#FFFFFF',
  /** Secondary / muted text on `inverseSurface`. */
  onInverseMuted: '#FBF4D9',
  /** Subtle fill inside an inverted block (stat tiles on the money card). */
  inverseTint: 'rgba(255,255,255,0.05)',
  /** Hairline inside an inverted block. */
  inverseDivider: 'rgba(255,255,255,0.08)',
  /** Modal / sheet backdrop. */
  scrim: 'rgba(0,0,0,0.35)',
  /** Translucent wash over content while it is busy. */
  veil: 'rgba(255,255,255,0.6)',
  /** Translucent gold wash (badges, highlighted rows). */
  goldWash: 'rgba(212,175,55,0.15)',
  /** Translucent warn wash (notice boxes). */
  warnWash: 'rgba(200,138,0,0.08)',
  /** Translucent danger wash (lapsed / error badges). */
  dangerWash: 'rgba(179,38,30,0.15)',
  /** Translucent ink wash (pressed overlays on dark surfaces). */
  inkWash: 'rgba(26,26,26,0.5)',
  /** Fill of a selected filter pill / calendar day. Its text is always `gold`. */
  selection: '#1A1A1A',
  /** Border of a selected filter pill. */
  selectionBorder: '#1A1A1A',
} as const;

export type ColorToken = keyof typeof lightColors;
export type Colors = Readonly<Record<ColorToken, string>>;

/**
 * Dark palette. Deep near-black surfaces, warm (slightly gold-leaning) greys,
 * gold untouched, state colors lifted so they clear 4.5:1 on #121212.
 */
export const darkColors: Colors = {
  gold: '#D4AF37',
  // Emphasis gold reads brighter on dark; #A88828 only clears ~5.6:1 on
  // #121212 and 4.5:1 on gold-tint, so lift it to keep headings/links crisp.
  goldDark: '#E0BF4F',
  goldTint: '#2A2515',
  ink: '#F5F3EC',
  ink2: '#C9C5B8',
  ink3: '#8A8A8A',
  surface: '#121212',
  surface2: '#1C1B18',
  divider: '#2E2C26',
  success: '#3DBB6E',
  warn: '#E0A21A',
  danger: '#EF6A62',
  sky: '#1C2A3A',

  goldLight: '#F2CD5B',
  onGold: '#1A1A1A',
  // One step warmer/lighter than surface2 so hero blocks still lift off the page.
  inverseSurface: '#26231A',
  onInverse: '#F5F3EC',
  onInverseMuted: '#C9C5B8',
  inverseTint: 'rgba(212,175,55,0.06)',
  inverseDivider: 'rgba(212,175,55,0.14)',
  scrim: 'rgba(0,0,0,0.6)',
  veil: 'rgba(18,18,18,0.6)',
  goldWash: 'rgba(212,175,55,0.16)',
  warnWash: 'rgba(224,162,26,0.10)',
  dangerWash: 'rgba(239,106,98,0.16)',
  inkWash: 'rgba(0,0,0,0.5)',
  selection: '#332C17',
  selectionBorder: '#D4AF37',
};

export const palettes = {
  light: lightColors,
  dark: darkColors,
} as const satisfies Record<'light' | 'dark', Colors>;

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
  palettes,
  typography,
  spacing,
  radii,
  motion,
} as const;

export type Theme = typeof theme;
