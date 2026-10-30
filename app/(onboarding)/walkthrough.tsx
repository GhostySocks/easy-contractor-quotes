import { router } from 'expo-router';
import { ClipboardList, Plus, Receipt } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const STEP_ICONS = [Plus, ClipboardList, Receipt] as const;

/**
 * Onboarding step 4 (ON-04 from PRD): a three-card guide to the main loop,
 * New Quote → Jobs → Get paid. Each card is a dark panel with a pulsing gold
 * icon; Skip goes straight to permissions.
 */
export default function Walkthrough() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const pulse = useSharedValue(0);
  const steps = strings.walkthrough.steps;
  const last = step === steps.length - 1;
  const Icon = STEP_ICONS[step];

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const finish = () => router.push('/(onboarding)/permissions');

  return (
    <OnboardingFrame
      progress={0.8}
      stepLabel="Step 4 of 5"
      title={steps[step].title}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label={last ? strings.walkthrough.cta : strings.walkthrough.next}
            onPress={last ? finish : () => setStep((s) => s + 1)}
          />
          {!last ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip the walkthrough"
              onPress={finish}
              hitSlop={8}
              style={styles.skip}
            >
              <Text style={styles.skipLabel}>{strings.walkthrough.skip}</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View style={styles.stage}>
        <View style={styles.dark}>
          <View style={styles.fabWrapper}>
            <Animated.View style={[styles.halo, haloStyle]} />
            <Animated.View style={[styles.fab, fabStyle]}>
              <Icon size={28} color={colors.onGold} strokeWidth={step === 0 ? 3 : 2.5} />
            </Animated.View>
          </View>
          <Text style={styles.body}>{steps[step].body}</Text>
        </View>
        <View style={styles.dots} accessibilityLabel={`Card ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.lg,
    },
    dark: {
      width: '100%',
      minHeight: 320,
      borderRadius: radii.xl,
      backgroundColor: colors.inverseSurface,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      gap: spacing.xxl,
    },
    fabWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    halo: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: colors.goldDark,
    },
    fab: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      fontFamily: typography.fonts.display,
      fontSize: typography.sizes.h3,
      color: colors.onInverseMuted,
      textAlign: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.divider,
    },
    dotActive: {
      width: 24,
      backgroundColor: colors.gold,
    },
    footer: {
      gap: spacing.sm,
    },
    skip: {
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    skipLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink3,
    },
  });
