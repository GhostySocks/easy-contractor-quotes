import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

export default function SignIn() {
  const styles = useStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // The root guard at / will route to /(tabs)/home or /app-paused based on
    // the subscription row. Just pop back to root and let it re-evaluate.
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>{strings.auth.signIn.title}</Text>
        <Text style={styles.subtitle}>{strings.auth.signIn.subtitle}</Text>

        <View style={styles.form}>
          <Input
            label={strings.auth.signIn.emailLabel}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Input
            label={strings.auth.signIn.passwordLabel}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="done"
            error={error ?? undefined}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={strings.auth.signIn.cta} loading={loading} onPress={handleSignIn} />
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.replace('/(auth)/sign-up')}
        >
          <Text style={styles.linkLabel}>{strings.auth.signIn.toSignUp}</Text>
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
      fontSize: typography.sizes.h1,
      fontWeight: '800',
      color: colors.ink,
    },
    subtitle: {
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
      minHeight: 44,
      justifyContent: 'center',
    },
    linkLabel: {
      color: colors.ink2,
      fontSize: typography.sizes.bodySmall,
      fontWeight: '600',
    },
  });
