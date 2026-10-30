import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function AppPaused() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
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
        <GhostButton
          label="View my jobs (read-only)"
          onPress={() => router.replace('/(tabs)/home')}
        />
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.inverseSurface,
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
      backgroundColor: colors.dangerWash,
      borderRadius: radii.pill,
    },
    pillLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.danger,
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.gold,
      textAlign: 'center',
    },
    body2: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.onInverseMuted,
      textAlign: 'center',
      opacity: 0.9,
    },
    meta: {
      fontFamily: typography.fonts.body,
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
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
      textAlign: 'center',
    },
  });
