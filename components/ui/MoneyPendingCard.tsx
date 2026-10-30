import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Stat = {
  count: number;
  label: string;
  danger?: boolean;
};

type Props = {
  totalCents: number;
  unpaidInvoices: number;
  unsignedContracts: number;
  overdueCount: number;
  /** Opens the Payments screen. */
  onPress?: () => void;
};

export function MoneyPendingCard({
  totalCents,
  unpaidInvoices,
  unsignedContracts,
  overdueCount,
  onPress,
}: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { dollars, cents } = splitCents(totalCents);

  const stats: Stat[] = [
    { count: unpaidInvoices, label: 'Unpaid' },
    { count: unsignedContracts, label: 'Unsigned' },
    { count: overdueCount, label: 'Overdue', danger: overdueCount > 0 },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Money pending. Open payments."
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.eyebrowRow}>
        <View style={styles.dot} />
        <Text style={styles.eyebrow}>MONEY PENDING</Text>
        {onPress ? (
          <View style={styles.open}>
            <Text style={styles.openLabel}>Payments</Text>
            <ChevronRight size={16} color={colors.gold} strokeWidth={2} />
          </View>
        ) : null}
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountSymbol}>$</Text>
        <Text style={styles.amountDollars}>{dollars}</Text>
        <Text style={styles.amountCents}>.{cents}</Text>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statCount, stat.danger && styles.statCountDanger]}>
              {stat.count}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function splitCents(total: number): { dollars: string; cents: string } {
  const abs = Math.abs(total);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const cents = (abs % 100).toString().padStart(2, '0');
  return { dollars, cents };
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.inverseSurface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      gap: spacing.md,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    eyebrow: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.gold,
      fontSize: typography.sizes.label,
      letterSpacing: 1.2,
    },
    open: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    openLabel: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.gold,
      fontSize: typography.sizes.bodySmall,
    },
    pressed: {
      opacity: 0.85,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    amountSymbol: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      color: colors.gold,
      fontSize: 40,
      lineHeight: 48,
      marginRight: 2,
    },
    amountDollars: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      color: colors.onInverse,
      fontSize: 44,
      lineHeight: 48,
      letterSpacing: -0.5,
    },
    amountCents: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      color: colors.ink3,
      fontSize: 22,
      lineHeight: 26,
      marginTop: 6,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    stat: {
      flex: 1,
      backgroundColor: colors.inverseTint,
      borderWidth: 1,
      borderColor: colors.inverseDivider,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    statCount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      color: colors.gold,
      fontSize: 20,
      lineHeight: 24,
    },
    statCountDanger: {
      color: colors.danger,
    },
    statLabel: {
      fontFamily: typography.fonts.bodyStrong,
      color: colors.onInverse,
      opacity: 0.85,
      fontSize: 13,
      lineHeight: 16,
      marginTop: 2,
    },
  });
