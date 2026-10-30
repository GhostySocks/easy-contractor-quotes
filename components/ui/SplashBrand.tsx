import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { strings } from '@/lib/strings';
import { lightColors, radii, spacing, typography } from '@/lib/theme';

/**
 * Splash brand lockup. Shown while the root guard bootstraps auth + sub.
 *
 * - Dark ink background with a soft gold radial glow from the top
 * - Gold gradient app icon with a trending-up glyph
 * - "Easy Contractor / Quotes" stack + "PRO" eyebrow
 * - White tagline
 * - Animated gold loading bar + helper copy at the bottom
 *
 * This screen is deliberately NOT themed: it must match the native splash
 * (#1A1A1A, see app.json) pixel-for-pixel in both modes, so it reads the
 * light palette's ink/surface directly rather than the active theme.
 */
const brand = lightColors;
const MARK = require('@/assets/images/splash-icon.png');

export function SplashBrand() {
  const barProgress = useSharedValue(0);

  useEffect(() => {
    barProgress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [barProgress]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -BAR_TRAVEL / 2 + barProgress.value * BAR_TRAVEL }],
  }));

  return (
    <View style={styles.root}>
      <RadialGlow />

      <View style={styles.inner}>
        <View style={styles.center}>
          <IconBadge />

          <View style={styles.nameStack}>
            <Text style={styles.name}>Easy Contractor</Text>
            <Text style={styles.name}>Quotes</Text>
          </View>

          <Text style={styles.proBadge}>PRO</Text>

          <Text style={styles.tagline}>{strings.app.tagline}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, barStyle]} />
          </View>
          <Text style={styles.loading}>Getting your jobs ready…</Text>
        </View>
      </View>
    </View>
  );
}

/** The gold house-and-quote mark, the same artwork as the app icon and native splash. */
function IconBadge() {
  return <Image source={MARK} style={styles.iconBadge} contentFit="contain" />;
}

function RadialGlow() {
  // viewBox + percentage radii so the glow scales with the SVG container at
  // any size (including web on resize). Avoid Dimensions.get('window') — on
  // web that snapshot can be narrower than the rendered SVG, leaving the tint
  // bounded short of the right edge.
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="25%" rx="80%" ry="60%">
          <Stop offset="0%" stopColor={brand.gold} stopOpacity="0.28" />
          <Stop offset="55%" stopColor={brand.gold} stopOpacity="0.06" />
          <Stop offset="100%" stopColor={brand.gold} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
    </Svg>
  );
}

const BAR_WIDTH = 56;
const BAR_TRAVEL = 140;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: brand.ink,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 120,
    height: 120,
    marginBottom: spacing.xl,
  },
  nameStack: {
    alignItems: 'center',
  },
  name: {
    fontFamily: typography.fonts.displayHeavy,
    fontSize: 32,
    lineHeight: 38,
    color: brand.surface,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  proBadge: {
    fontFamily: typography.fonts.bodyStrong,
    fontSize: typography.sizes.label,
    color: brand.gold,
    letterSpacing: 6,
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: typography.fonts.body,
    marginTop: spacing.lg,
    fontSize: typography.sizes.bodySmall,
    color: brand.surface,
    opacity: 0.8,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  barTrack: {
    width: BAR_TRAVEL + BAR_WIDTH,
    height: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: radii.sm,
    backgroundColor: brand.gold,
  },
  loading: {
    fontFamily: typography.fonts.bodyStrong,
    fontSize: typography.sizes.label,
    color: brand.goldDark,
    opacity: 0.6,
    letterSpacing: 0.4,
  },
});
