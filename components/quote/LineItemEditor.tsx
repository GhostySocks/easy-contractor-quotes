import { Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LineItem } from '@/lib/ai';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /**
   * Change orders can take money off. Each line then gets a Charge / Credit
   * switch; a credit is stored as a negative unit price. The price is always
   * typed as a plain positive number, since phone number pads have no minus.
   */
  allowCredits?: boolean;
  /** Placeholder for a line's name. */
  labelPlaceholder?: string;
};

export function LineItemEditor({ items, onChange, allowCredits, labelPlaceholder }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  function updateItem(index: number, patch: Partial<LineItem>) {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const merged = { ...item, ...patch };
      merged.total_cents = Math.round(merged.qty * merged.unit_price_cents);
      return merged;
    });
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { label: '', qty: 1, unit_price_cents: 0, total_cents: 0 }]);
  }

  return (
    <View style={styles.list}>
      <Text style={styles.sectionLabel}>Line items</Text>

      {items.map((item, index) => (
        <View key={index} style={styles.card}>
          <TextInput
            value={item.label}
            onChangeText={(label) => updateItem(index, { label })}
            placeholder={labelPlaceholder ?? 'Labor, materials, travel…'}
            placeholderTextColor={colors.ink3}
            style={styles.labelField}
            multiline
          />

          {allowCredits ? (
            <View style={styles.signRow} accessibilityRole="radiogroup">
              {(['charge', 'credit'] as const).map((kind) => {
                const isCredit = isNegative(item.unit_price_cents);
                const selected = (kind === 'credit') === isCredit;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={
                      kind === 'credit' ? 'Credit: takes money off' : 'Charge: adds to the total'
                    }
                    onPress={() => {
                      if (selected) return;
                      updateItem(index, { unit_price_cents: -item.unit_price_cents });
                    }}
                    style={[styles.signChip, selected && styles.signChipOn]}
                  >
                    <Text style={[styles.signLabel, selected && styles.signLabelOn]}>
                      {kind === 'credit' ? 'Credit' : 'Charge'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.numberRow}>
            <View style={styles.numberGroup}>
              <Text style={styles.numberLabel}>Qty</Text>
              <TextInput
                value={String(item.qty)}
                onChangeText={(text) => updateItem(index, { qty: toNumber(text, item.qty) })}
                keyboardType="numeric"
                style={[styles.numberField, styles.qtyField]}
                selectTextOnFocus
              />
            </View>

            <View style={styles.numberGroup}>
              <Text style={styles.numberLabel}>Unit</Text>
              <TextInput
                value={centsToDollarInput(Math.abs(item.unit_price_cents))}
                onChangeText={(text) =>
                  updateItem(index, {
                    unit_price_cents:
                      dollarInputToCents(text) * (isNegative(item.unit_price_cents) ? -1 : 1),
                  })
                }
                keyboardType="decimal-pad"
                style={[styles.numberField, styles.priceField]}
                selectTextOnFocus
              />
            </View>

            <View style={styles.totalGroup}>
              <Text style={styles.numberLabel}>Total</Text>
              <Text style={styles.total}>{formatCents(item.total_cents)}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label || 'line item'}`}
              onPress={() => removeItem(index)}
              hitSlop={10}
              style={styles.trash}
            >
              <Trash2 size={18} color={colors.ink3} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={addItem} style={styles.addButton}>
        <Text style={styles.addLabel}>+ Add line item</Text>
      </Pressable>
    </View>
  );
}

/** Negative, counting -0: a line marked Credit before its price is typed. */
function isNegative(n: number): boolean {
  return n < 0 || Object.is(n, -0);
}

function toNumber(text: string, fallback: number): number {
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarInputToCents(text: string): number {
  const clean = text.replace(/[^0-9.]/g, '');
  const dollars = Number(clean);
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    list: {
      gap: spacing.md,
    },
    signRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    signChip: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    },
    signChipOn: {
      backgroundColor: colors.goldTint,
      borderColor: colors.gold,
    },
    signLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    signLabelOn: {
      color: colors.goldDark,
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    labelField: {
      fontFamily: typography.fonts.bodyStrong,
      backgroundColor: colors.surface2,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.body,
      color: colors.ink,
      minHeight: 44,
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    numberGroup: {
      flex: 1,
      gap: spacing.xs,
    },
    totalGroup: {
      gap: spacing.xs,
      alignItems: 'flex-end',
      minWidth: 80,
    },
    numberLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.ink3,
    },
    numberField: {
      fontFamily: typography.fonts.numeric,
      backgroundColor: colors.surface2,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
      minHeight: 40,
    },
    qtyField: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    priceField: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    total: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
      paddingVertical: spacing.sm,
    },
    trash: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    addButton: {
      marginTop: spacing.xs,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.md,
      borderColor: colors.divider,
      borderWidth: 1,
      borderStyle: 'dashed',
      minHeight: typography.minTouchTarget,
    },
    addLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
  });
