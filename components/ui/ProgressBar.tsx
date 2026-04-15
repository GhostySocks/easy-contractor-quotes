import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

type Props = {
  /** 0 to 1 */
  value: number;
};

export function ProgressBar({ value }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const percent = `${clamped * 100}%` as const;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: clamped * 100, min: 0, max: 100 }}
    >
      <View style={[styles.fill, { width: percent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.divider,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    backgroundColor: colors.gold,
    borderRadius: radii.sm,
  },
});
