import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/lib/theme';

type Props = {
  initials: string;
  size?: number;
};

export function Avatar({ initials, size = 44 }: Props) {
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

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  text: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    color: colors.goldDark,
    letterSpacing: 0.3,
  },
});
