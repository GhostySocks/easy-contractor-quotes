import { StyleSheet, Text, View } from 'react-native';

import { radii, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  initials: string;
  size?: number;
};

export function Avatar({ initials, size = 44 }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Account initials ${initials}`}
      style={[styles.root, { width: size, height: size, borderRadius: radii.pill }]}
    >
      <Text style={styles.text}>{initials}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.divider,
    },
    text: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
      letterSpacing: 0.3,
    },
  });
