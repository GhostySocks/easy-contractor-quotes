import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function AppPaused() {
  const subscription = useAuth((s) => s.subscription);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.badgeWrapper}>
          <View style={styles.lockBadge}>
            <Lock size={28} color={colors.goldDark} strokeWidth={2} />
          </View>
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillLabel}>{strings.appPaused.pill}</Text>
        </View>

        <Text style={styles.title}>{strings.appPaused.title}</Text>
        <Text style={styles.body2}>{strings.appPaused.body}</Text>

        {subscription?.current_period_end ? (
          <Text style={styles.meta}>
            Paused since {new Date(subscription.current_period_end).toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={strings.appPaused.cta} onPress={() => router.push('/paywall')} />
        <GhostButton label={strings.appPaused.export} onPress={() => router.push('/settings')} />
        <Text style={styles.support}>{strings.appPaused.support}</Text>
        <SignOutButton />
      </View>
    </SafeAreaView>
  );
}

function SignOutButton() {
  return (
    <GhostButton
      label="Sign out"
      onPress={async () => {
        await supabase.auth.signOut();
        router.replace('/(onboarding)/welcome');
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  badgeWrapper: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  lockBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(179, 38, 30, 0.15)',
    borderRadius: radii.pill,
  },
  pillLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.danger,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: '800',
    color: colors.gold,
    textAlign: 'center',
  },
  body2: {
    fontSize: typography.sizes.body,
    color: colors.goldTint,
    textAlign: 'center',
    opacity: 0.9,
  },
  meta: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  support: {
    fontSize: typography.sizes.bodySmall,
    color: colors.goldDark,
    textAlign: 'center',
  },
});
