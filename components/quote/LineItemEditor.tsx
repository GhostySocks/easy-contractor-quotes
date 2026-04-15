import { Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LineItem } from '@/lib/ai';
import { formatCents } from '@/lib/pricing';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
};

export function LineItemEditor({ items, onChange }: Props) {
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
        <View key={index} style={styles.row}>
          <TextInput
            value={item.label}
            onChangeText={(label) => updateItem(index, { label })}
            placeholder="Labor, materials, travel…"
            placeholderTextColor={colors.ink3}
            style={[styles.field, styles.labelField]}
          />
          <TextInput
            value={String(item.qty)}
            onChangeText={(text) => updateItem(index, { qty: toNumber(text, item.qty) })}
            keyboardType="numeric"
            style={[styles.field, styles.qtyField]}
          />
          <TextInput
            value={centsToDollarInput(item.unit_price_cents)}
            onChangeText={(text) =>
              updateItem(index, { unit_price_cents: dollarInputToCents(text) })
            }
            keyboardType="decimal-pad"
            style={[styles.field, styles.priceField]}
          />
          <Text style={styles.total}>{formatCents(item.total_cents)}</Text>
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

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  field: {
    backgroundColor: colors.surface2,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.bodySmall,
    color: colors.ink,
  },
  labelField: {
    flex: 2,
  },
  qtyField: {
    width: 48,
    textAlign: 'center',
  },
  priceField: {
    width: 72,
    textAlign: 'right',
  },
  total: {
    width: 72,
    textAlign: 'right',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    color: colors.ink,
  },
  trash: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    color: colors.goldDark,
  },
});
