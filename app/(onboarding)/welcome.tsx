import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useOnboardingDraft } from '@/lib/onboarding-store';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

export default function Welcome() {
  const styles = useStyles(makeStyles);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>Step 1 of 5</Text>
        <Text style={styles.hero}>
          Quote any job in <Text style={styles.heroAccent}>60 seconds</Text>.
        </Text>
        <Text style={styles.sub}>{strings.welcome.sub}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={strings.welcome.cta}
          onPress={() => router.push('/(onboarding)/goals')}
        />
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.linkLabel}>{strings.welcome.alreadyHaveAccount}</Text>
        </Pressable>

        {__DEV__ ? <DevResetLink /> : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * Dev-only "start over" — signs out of Supabase and clears the in-memory
 * onboarding draft, then re-routes to /welcome so the next test run is clean.
 * Renders nothing in production builds.
 */
function DevResetLink() {
  const styles = useStyles(makeStyles);
  async function handleReset() {
    await supabase.auth.signOut();
    useOnboardingDraft.getState().reset();
    router.replace('/(onboarding)/welcome');
  }
  return (
    <Pressable accessibilityRole="button" style={styles.devReset} onPress={handleReset}>
      <Text style={styles.devResetLabel}>DEV — reset & start over</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
      paddingHorizontal: spacing.xl,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    eyebrow: {
      fontSize: typography.sizes.label,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    hero: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: '800',
      color: colors.ink,
    },
    heroAccent: {
      color: colors.gold,
    },
    sub: {
      fontSize: typography.sizes.body,
      lineHeight: 26,
      color: colors.ink2,
    },
    footer: {
      paddingVertical: spacing.xl,
      gap: spacing.md,
    },
    link: {
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    linkLabel: {
      color: colors.ink2,
      fontSize: typography.sizes.bodySmall,
      fontWeight: '600',
    },
    devReset: {
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    devResetLabel: {
      color: colors.ink3,
      fontSize: typography.sizes.label,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
  });
