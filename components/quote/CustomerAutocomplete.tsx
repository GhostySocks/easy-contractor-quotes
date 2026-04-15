import { Plus, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { createCustomer, type CustomerRow, searchCustomers } from '@/lib/customers';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  name: string;
  onChangeName: (value: string) => void;
  onSelect: (customer: CustomerRow) => void;
};

/**
 * Typeahead customer search inside the New Quote form. Starts returning the
 * 8 most recently active customers as soon as the field is focused; narrows
 * the list as the contractor types.
 *
 * When there is no exact match, a "Create new: {name}" row lets the user
 * insert a new `customers` row with just the name — address/phone/email can
 * be filled later from the customer detail screen (M2).
 */
export function CustomerAutocomplete({ name, onChangeName, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchCustomers(name).then(setResults);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, open]);

  const trimmed = name.trim();
  const exactMatch = results.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  async function handleCreate() {
    setCreating(true);
    const created = await createCustomer({ name: trimmed });
    setCreating(false);
    if (created) {
      onSelect(created);
      setOpen(false);
    }
  }

  return (
    <View>
      <Input
        label="Customer"
        placeholder="Type a name"
        value={name}
        onChangeText={onChangeName}
        onFocus={() => setOpen(true)}
        autoCapitalize="words"
        returnKeyType="search"
      />

      {open ? (
        <View style={styles.dropdown}>
          {showCreate ? (
            <Pressable
              style={styles.row}
              onPress={handleCreate}
              disabled={creating}
              accessibilityRole="button"
            >
              <View style={styles.iconBadge}>
                <Plus size={18} color={colors.goldDark} strokeWidth={2.5} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Create new</Text>
                <Text style={styles.rowSub}>{trimmed}</Text>
              </View>
            </Pressable>
          ) : null}

          {results.map((customer) => (
            <Pressable
              key={customer.id}
              style={styles.row}
              accessibilityRole="button"
              onPress={() => {
                onSelect(customer);
                setOpen(false);
              }}
            >
              <View style={styles.iconBadge}>
                <UserRound size={18} color={colors.goldDark} strokeWidth={2} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{customer.name}</Text>
                <Text style={styles.rowSub}>
                  {customer.city ?? customer.phone ?? customer.email ?? 'no details yet'}
                </Text>
              </View>
            </Pressable>
          ))}

          {!showCreate && results.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyLabel}>No customers yet. Start typing to create one.</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    color: colors.ink,
  },
  rowSub: {
    fontSize: typography.sizes.label,
    color: colors.ink3,
  },
  empty: {
    padding: spacing.md,
  },
  emptyLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    textAlign: 'center',
  },
});
