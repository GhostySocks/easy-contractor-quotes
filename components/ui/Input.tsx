import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, containerStyle, style, ...rest },
  ref,
) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, !!error && styles.inputError, style]}
        placeholderTextColor={colors.ink3}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    label: {
      fontSize: typography.sizes.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    input: {
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.divider,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      fontSize: typography.sizes.label,
      color: colors.danger,
    },
  });
