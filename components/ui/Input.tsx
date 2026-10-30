import { forwardRef, useState } from 'react';
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
  { label, error, containerStyle, style, onFocus, onBlur, ...rest },
  ref,
) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  // A gold border while typing shows which field is active.
  const [focused, setFocused] = useState(false);
  // Passwords and email addresses must not auto-capitalize or autocorrect.
  // Android keyboards capitalize the first letter of a password field unless
  // told otherwise. A caller can still override any of these.
  const credential = !!rest.secureTextEntry || rest.keyboardType === 'email-address';
  const credentialDefaults = credential
    ? { autoCapitalize: 'none' as const, autoCorrect: false, spellCheck: false }
    : {};
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          rest.editable === false && styles.inputDisabled,
          style,
        ]}
        placeholderTextColor={colors.ink3}
        {...credentialDefaults}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
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
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    input: {
      fontFamily: typography.fonts.body,
      minHeight: 48,
      borderRadius: radii.md,
      // White, like the chips, so it stands out from the off-white page and
      // reads as ready to type in rather than disabled.
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.divider,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    inputFocused: {
      borderColor: colors.gold,
    },
    inputDisabled: {
      backgroundColor: colors.surface2,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.danger,
    },
  });
