import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Props = {
  children: ReactNode;
  dark?: boolean;
  style?: ViewStyle;
};

export function Card({ children, dark, style }: Props) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  cardDark: {
    backgroundColor: colors.ink,
    borderColor: colors.goldDark,
  },
});
