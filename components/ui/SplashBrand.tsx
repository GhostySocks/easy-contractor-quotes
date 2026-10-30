import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp } from 'lucide-react-native';
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

function IconBadge() {
  return (
    <View style={styles.iconShadow}>
      <View style={styles.iconBadge}>
        <LinearGradient
          colors={[brand.goldLight, brand.gold, brand.goldDark]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <TrendingUp size={56} color={brand.onGold} strokeWidth={2.5} />
      </View>
    </View>
  );
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
  iconShadow: {
    shadowColor: brand.goldDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBadge: {
    width: 112,
    height: 112,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  nameStack: {
    alignItems: 'center',
  },
  name: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: brand.surface,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  proBadge: {
    fontSize: typography.sizes.label,
    fontWeight: '800',
    color: brand.gold,
    letterSpacing: 6,
    marginTop: spacing.sm,
  },
  tagline: {
    marginTop: spacing.lg,
    fontSize: typography.sizes.bodySmall,
    color: brand.surface,
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '500',
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
    fontSize: typography.sizes.label,
    color: brand.goldDark,
    opacity: 0.6,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
