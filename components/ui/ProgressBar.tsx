import { StyleSheet, View } from 'react-native';

import { radii, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  /** 0 to 1 */
  value: number;
};

export function ProgressBar({ value }: Props) {
  const styles = useStyles(makeStyles);
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
