import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Stat = {
  count: number;
  label: string;
  caption?: string;
};

type Props = {
  totalCents: number;
  unpaidInvoices: number;
  pendingSignature: number;
  overdueCount: number;
  overdueMaxDays: number;
};

export function MoneyPendingCard({
  totalCents,
  unpaidInvoices,
  pendingSignature,
  overdueCount,
  overdueMaxDays,
}: Props) {
  const { dollars, cents } = splitCents(totalCents);

  const stats: Stat[] = [
    { count: unpaidInvoices, label: 'Unpaid\ninvoices' },
    { count: pendingSignature, label: 'Pending\nsignature' },
    {
      count: overdueCount,
      label: 'Overdue',
      caption: overdueCount > 0 ? `${overdueMaxDays}+` : undefined,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <View style={styles.diamond} />
        <Text style={styles.eyebrow}>MONEY PENDING</Text>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountDollars}>${dollars}</Text>
        <Text style={styles.amountCents}>.{cents}</Text>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat, i) => (
          <View key={stat.label} style={[styles.stat, i !== 0 && styles.statDivider]}>
            <Text style={styles.statCount}>{stat.count}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.caption ? <Text style={styles.statCaption}>{stat.caption}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function splitCents(total: number): { dollars: string; cents: string } {
  const abs = Math.abs(total);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const cents = (abs % 100).toString().padStart(2, '0');
  return { dollars, cents };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  diamond: {
    width: 8,
    height: 8,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.sizes.label,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  amountDollars: {
    color: colors.gold,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  amountCents: {
    color: colors.gold,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  stat: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  statCount: {
    color: colors.gold,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  statLabel: {
    color: colors.surface,
    opacity: 0.75,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  statCaption: {
    color: colors.goldDark,
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
