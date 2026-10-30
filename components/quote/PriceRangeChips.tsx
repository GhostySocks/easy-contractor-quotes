import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCents, type PriceBucket } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

export type { PriceBucket };

type Props = {
  low_cents: number;
  most_likely_cents: number;
  high_cents: number;
  selected: PriceBucket;
  onSelect: (bucket: PriceBucket) => void;
};

const labels: Record<PriceBucket, string> = {
  low: 'Low',
  most_likely: 'Most likely',
  high: 'High',
};

export function PriceRangeChips({
  low_cents,
  most_likely_cents,
  high_cents,
  selected,
  onSelect,
}: Props) {
  const styles = useStyles(makeStyles);
  const options: { key: PriceBucket; cents: number }[] = [
    { key: 'low', cents: low_cents },
    { key: 'most_likely', cents: most_likely_cents },
    { key: 'high', cents: high_cents },
  ];

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const isSelected = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(opt.key)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {labels[opt.key]}
            </Text>
            <Text style={[styles.amount, isSelected && styles.amountSelected]}>
              {formatCents(opt.cents)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    chipSelected: {
      backgroundColor: colors.goldTint,
      borderColor: colors.gold,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    labelSelected: {
      color: colors.goldDark,
    },
    amount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    amountSelected: {
      color: colors.goldDark,
    },
  });
