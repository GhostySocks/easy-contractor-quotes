import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Shimmer } from '@/components/ui/Shimmer';
import { strings } from '@/lib/strings';
import { colors, spacing, typography } from '@/lib/theme';

/**
 * Splash screen. Shown on cold start while auth + entitlement are resolved.
 * In M1 the root guard picks the destination based on:
 *   signed-out         -> /welcome
 *   signed-in, active  -> /(tabs)/home
 *   signed-in, lapsed  -> /app-paused
 *
 * For now it just displays the shimmer and a Continue button so M0 is navigable.
 */
export default function Splash() {
  useEffect(() => {
    // No automatic navigation in M0 — let the human tap through.
    // The guard logic will live here from M1 onward.
  }, []);

  return (
    <View style={styles.container}>
      <Shimmer>
        <Text style={styles.wordmark}>ECQ</Text>
      </Shimmer>
      <Text style={styles.tagline}>{strings.app.tagline}</Text>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => router.push('/(onboarding)/welcome')}>
          <Text style={styles.buttonLabel}>Continue to onboarding</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonGhost]}
          onPress={() => router.push('/(tabs)/home')}
        >
          <Text style={[styles.buttonLabel, styles.buttonLabelGhost]}>
            Skip to tabs (M0 preview)
          </Text>
        </Pressable>
      </View>

      <Text style={styles.version}>v1.0 · M0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
  },
  wordmark: {
    fontSize: 72,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 2,
  },
  tagline: {
    marginTop: spacing.md,
    color: colors.goldTint,
    opacity: 0.8,
    fontSize: typography.sizes.bodySmall,
  },
  actions: {
    marginTop: spacing.huge,
    width: '100%',
    gap: spacing.md,
  },
  button: {
    minHeight: typography.minTouchTarget,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.goldDark,
  },
  buttonLabel: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 17,
  },
  buttonLabelGhost: {
    color: colors.goldTint,
  },
  version: {
    position: 'absolute',
    bottom: spacing.xl,
    color: colors.goldDark,
    opacity: 0.5,
    fontSize: typography.sizes.label,
  },
});
