import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';

type Props = {
  name: string;
  subtitle?: string;
};

/**
 * Placeholder for every route in M0.
 * Replaces with the real screen as each feature lands.
 */
export function ScreenStub({ name, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Route</Text>
      <Text style={styles.name}>{name}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    padding: spacing.xl,
  },
  label: {
    fontSize: typography.sizes.label,
    color: colors.ink3,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: typography.sizes.h1,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.md,
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
    textAlign: 'center',
  },
});
