import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DEV_BYPASS_PAYWALL } from '@/lib/dev-flags';
import { commitOnboardingProfile } from '@/lib/onboarding-commit';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

export default function SignUp() {
  const styles = useStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError('Enter a valid email and a password with at least 8 characters.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Dev-only escape hatch: skip the paywall, commit the profile, jump to home.
    // Production builds always send the user to /paywall (see lib/dev-flags.ts).
    if (DEV_BYPASS_PAYWALL) {
      await commitOnboardingProfile(data.user?.id);
      router.replace('/(tabs)/home');
      return;
    }

    router.replace('/paywall');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>{strings.auth.signUp.title}</Text>
        <Text style={styles.subtitle}>{strings.auth.signUp.subtitle}</Text>

        <View style={styles.form}>
          <Input
            label={strings.auth.signUp.emailLabel}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Input
            label={strings.auth.signUp.passwordLabel}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            error={error ?? undefined}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={strings.auth.signUp.cta} loading={loading} onPress={handleSignUp} />
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={styles.linkLabel}>{strings.auth.signUp.toSignIn}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    form: {
      gap: spacing.lg,
      paddingTop: spacing.md,
    },
    footer: {
      paddingVertical: spacing.xl,
      gap: spacing.md,
    },
    link: {
      alignItems: 'center',
      minHeight: typography.minTouchTarget,
      justifyContent: 'center',
    },
    linkLabel: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.ink2,
      fontSize: typography.sizes.bodySmall,
    },
  });
