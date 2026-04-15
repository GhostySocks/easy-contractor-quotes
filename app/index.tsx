import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Shimmer } from '@/components/ui/Shimmer';
import { useAuth } from '@/lib/auth-store';
import { isActive } from '@/lib/entitlement';
import { strings } from '@/lib/strings';
import { colors, spacing, typography } from '@/lib/theme';

/**
 * Root guard. Decides where to send the user on cold start and on resume.
 *
 *   not-bootstrapped  -> show the splash shimmer
 *   no session        -> /welcome
 *   session + paused  -> /app-paused
 *   session + active  -> /(tabs)/home
 *
 * After onboarding + first purchase the user lands on /(tabs)/home directly;
 * re-opening the app with a valid session skips onboarding entirely.
 */
export default function Splash() {
  const bootstrapped = useAuth((s) => s.bootstrapped);
  const session = useAuth((s) => s.session);
  const subscription = useAuth((s) => s.subscription);

  if (!bootstrapped) {
    return <Shimmering />;
  }

  if (!session) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!isActive(subscription)) {
    return <Redirect href="/app-paused" />;
  }

  return <Redirect href="/(tabs)/home" />;
}

function Shimmering() {
  return (
    <View style={styles.container}>
      <Shimmer>
        <Text style={styles.wordmark}>ECQ</Text>
      </Shimmer>
      <Text style={styles.tagline}>{strings.app.tagline}</Text>
      <Text style={styles.version}>v1.0</Text>
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
  version: {
    position: 'absolute',
    bottom: spacing.xl,
    color: colors.goldDark,
    opacity: 0.5,
    fontSize: typography.sizes.label,
  },
});
