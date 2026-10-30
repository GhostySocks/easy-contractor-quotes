import { Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LineItem } from '@/lib/ai';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
};

export function LineItemEditor({ items, onChange }: Props) {
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
            placeholder="Labor, materials, travel…"
            placeholderTextColor={colors.ink3}
            style={styles.labelField}
            multiline
          />

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
                value={centsToDollarInput(item.unit_price_cents)}
                onChangeText={(text) =>
                  updateItem(index, { unit_price_cents: dollarInputToCents(text) })
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
              hitSlop={8}
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
    sectionLabel: {
      fontSize: typography.sizes.label,
      fontWeight: '700',
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
      backgroundColor: colors.surface2,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.body,
      fontWeight: '600',
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
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.ink3,
    },
    numberField: {
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
      textAlign: 'center',
    },
    priceField: {
      textAlign: 'right',
    },
    total: {
      fontSize: typography.sizes.body,
      fontWeight: '800',
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
    },
    addLabel: {
      fontSize: typography.sizes.bodySmall,
      fontWeight: '700',
      color: colors.goldDark,
    },
  });
