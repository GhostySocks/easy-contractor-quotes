import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
  accessibilityLabel,
}: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onGold} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    button: {
      minHeight: typography.minTouchTarget,
      borderRadius: radii.lg,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      shadowColor: colors.goldDark,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 4,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.94,
    },
    disabled: {
      opacity: 0.5,
      shadowOpacity: 0,
      elevation: 0,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.onGold,
      fontSize: 17,
    },
  });
