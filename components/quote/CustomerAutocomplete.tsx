import { Plus, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { createCustomer, type CustomerRow, searchCustomers } from '@/lib/customers';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

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
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
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
          {results.length > 0 ? (
            <View style={styles.sectionLabelWrap}>
              <Text style={styles.sectionLabel}>{trimmed ? 'Matches' : 'Recent customers'}</Text>
            </View>
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

          {showCreate ? (
            <Pressable
              style={[styles.createRow, results.length > 0 && styles.createRowDivided]}
              onPress={handleCreate}
              disabled={creating}
              accessibilityRole="button"
            >
              <Plus size={16} color={colors.ink3} strokeWidth={2.5} />
              <Text style={styles.createLabel}>
                {results.length > 0 ? `Don't see them? Create "${trimmed}"` : `Create "${trimmed}"`}
              </Text>
            </Pressable>
          ) : null}

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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
      minHeight: typography.minTouchTarget,
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
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    rowSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    empty: {
      padding: spacing.md,
    },
    emptyLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      textAlign: 'center',
    },
    sectionLabelWrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.ink3,
    },
    createRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface2,
      minHeight: typography.minTouchTarget,
    },
    createRowDivided: {
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    createLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
      flexShrink: 1,
    },
  });
