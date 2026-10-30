import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function GhostButton({ label, onPress, disabled, style, accessibilityLabel }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    button: {
      minHeight: typography.minTouchTarget,
      borderRadius: radii.lg,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.ink,
      fontSize: 17,
    },
  });
