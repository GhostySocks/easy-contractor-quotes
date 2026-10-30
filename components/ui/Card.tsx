import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radii, spacing, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  children: ReactNode;
  dark?: boolean;
  style?: ViewStyle;
};

export function Card({ children, dark, style }: Props) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    cardDark: {
      backgroundColor: colors.inverseSurface,
      borderColor: colors.goldDark,
    },
  });
