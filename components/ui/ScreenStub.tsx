import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

type Props = {
  name: string;
  subtitle?: string;
};

/**
 * Placeholder for every route in M0.
 * Replaces with the real screen as each feature lands.
 */
export function ScreenStub({ name, subtitle }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Route</Text>
      <Text style={styles.name}>{name}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface2,
      padding: spacing.xl,
    },
    label: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.label,
      color: colors.ink3,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    name: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.ink,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      marginTop: spacing.md,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
      textAlign: 'center',
    },
  });
