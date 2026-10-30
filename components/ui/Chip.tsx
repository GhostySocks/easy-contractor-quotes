import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    chip: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.goldTint,
      borderColor: colors.gold,
    },
    chipPressed: {
      opacity: 0.85,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 14,
      color: colors.ink,
    },
    labelSelected: {
      color: colors.goldDark,
    },
  });
