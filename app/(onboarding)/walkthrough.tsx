import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

/**
 * Onboarding step 4 (ON-04 from PRD). A dark card with a pulsing gold FAB
 * callout to teach the primary action. Not in CLAUDE.md §5 v1.0 — added here
 * as part of the same commit that updates §5 to include walkthrough.tsx.
 */
export default function Walkthrough() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

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

  return (
    <OnboardingFrame
      progress={0.8}
      stepLabel="Step 4 of 5"
      title={strings.walkthrough.title}
      footer={
        <PrimaryButton
          label={strings.walkthrough.cta}
          onPress={() => router.push('/(onboarding)/permissions')}
        />
      }
    >
      <View style={styles.stage}>
        <View style={styles.dark}>
          <View style={styles.fabWrapper}>
            <Animated.View style={[styles.halo, haloStyle]} />
            <Animated.View style={[styles.fab, fabStyle]}>
              <Plus size={28} color={colors.onGold} strokeWidth={3} />
            </Animated.View>
          </View>
          <Text style={styles.body}>{strings.walkthrough.body}</Text>
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
      fontSize: typography.sizes.h3,
      fontWeight: '700',
      color: colors.onInverseMuted,
      textAlign: 'center',
    },
  });
