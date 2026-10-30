import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Gold shimmer for the splash wordmark.
 * 1200ms infinite easeInOut per CLAUDE.md §4.
 */
export function Shimmer({ children, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: motion.durations.splashShimmer,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + progress.value * 0.35,
    transform: [{ scale: 0.98 + progress.value * 0.04 }],
  }));

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
