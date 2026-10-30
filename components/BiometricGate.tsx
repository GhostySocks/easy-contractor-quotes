import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { shouldLock, useBiometricPref } from '@/lib/biometric-lock';
import { supabase } from '@/lib/supabase';
import { lightColors, spacing, typography } from '@/lib/theme';

const LOGO = require('@/assets/images/splash-icon.png');

/**
 * Covers the app with a lock screen until Face ID / fingerprint succeeds
 * (CLAUDE.md §3.7). Asks on a cold start with a saved session and again
 * after a minute in the background. "Use password instead" signs out, so the
 * fallback is the normal email + password sign-in.
 *
 * Does nothing on devices without biometrics enrolled, when signed out, or
 * when the user turned it off in Settings. Like the splash, it's always the
 * dark brand look, so nothing behind it shows through in either theme.
 */
export function BiometricGate() {
  const signedIn = useAuth((s) => !!s.session);
  const bootstrapped = useAuth((s) => s.bootstrapped);
  const enabled = useBiometricPref((s) => s.enabled);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const unlockedOnce = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [hardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setAvailable(hardware && enrolled);
    })();
  }, []);

  // Cold start: lock once the saved session is known.
  useEffect(() => {
    if (!bootstrapped) return;
    setLocked(
      shouldLock({
        enabled,
        available,
        signedIn,
        backgroundedAt: null,
        now: Date.now(),
        unlocked: unlockedOnce.current,
      }),
    );
  }, [bootstrapped, enabled, available, signedIn]);

  // Resume: lock again after a minute away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const lock = shouldLock({
          enabled,
          available,
          signedIn,
          backgroundedAt: backgroundedAt.current,
          now: Date.now(),
          unlocked: unlockedOnce.current,
        });
        backgroundedAt.current = null;
        if (lock) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled, available, signedIn]);

  const unlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Easy Contractor Quotes',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        unlockedOnce.current = true;
        setLocked(false);
      }
    } finally {
      setPrompting(false);
    }
  }, [prompting]);

  // Prompt straight away when the lock appears; the button is the retry.
  useEffect(() => {
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const signInWithPassword = useCallback(async () => {
    await supabase.auth.signOut();
    setLocked(false);
    router.replace('/(auth)/sign-in');
  }, []);

  if (!locked) return null;

  return (
    <View style={styles.cover} accessibilityViewIsModal>
      <Image source={LOGO} style={styles.logo} contentFit="contain" />
      <Text style={styles.title}>Locked</Text>
      <Text style={styles.sub}>Use Face ID or your fingerprint to open your jobs.</Text>
      <View style={styles.actions}>
        <PrimaryButton label={prompting ? 'Waiting…' : 'Unlock'} onPress={() => void unlock()} />
        <Pressable
          accessibilityRole="button"
          onPress={() => void signInWithPassword()}
          hitSlop={8}
          style={styles.link}
        >
          <Text style={styles.linkLabel}>Use password instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const brand = lightColors;

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fonts.displayHeavy,
    fontSize: typography.sizes.h1,
    color: brand.surface,
  },
  sub: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body,
    color: brand.ink3,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  link: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkLabel: {
    fontFamily: typography.fonts.bodyStrong,
    fontSize: typography.sizes.body,
    color: brand.gold,
  },
});
