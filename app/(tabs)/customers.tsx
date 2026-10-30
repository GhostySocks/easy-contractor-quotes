import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCustomers, type CustomerWithJobs } from '@/lib/customers';
import { formatCents } from '@/lib/pricing';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<CustomerWithJobs[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (query: string) => {
    const rows = await listCustomers({ search: query });
    setCustomers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load(search).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [search, load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.count}>
            {customers.length} {customers.length === 1 ? 'person' : 'people'}
          </Text>
        </View>

        <SearchField value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <CustomerListItem
            customer={item}
            onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item.id } })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(search);
              setRefreshing(false);
            }}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyState}>
              {search
                ? 'No customers match this search.'
                : 'Customers show up here automatically as you quote jobs.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function CustomerListItem({
  customer,
  onPress,
}: {
  customer: CustomerWithJobs;
  onPress: () => void;
}) {
  const subtitle = customer.phone ?? customer.email ?? 'No contact info yet';
  const isRepeat = customer.job_count >= 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}${isRepeat ? ', repeat customer' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.middleCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {customer.name || 'Unnamed customer'}
          </Text>
          {isRepeat ? <RepeatBadge /> : null}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.ltv}>{formatCents(customer.lifetime_value_cents)}</Text>
        <Text style={styles.ltvLabel}>LIFETIME</Text>
      </View>
    </Pressable>
  );
}

function RepeatBadge() {
  return (
    <View style={styles.repeatBadge}>
      <Text style={styles.repeatBadgeLabel}>REPEAT</Text>
    </View>
  );
}

function SearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.search}>
      <Search size={18} color={colors.ink3} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search customers by name"
        placeholderTextColor={colors.ink3}
        style={styles.searchInput}
        returnKeyType="search"
        autoCapitalize="words"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={12}
        >
          <X size={18} color={colors.ink3} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.sizes.display,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  count: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '600',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '500',
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge + spacing.huge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  rowPressed: {
    opacity: 0.75,
  },
  middleCol: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 22,
  },
  sub: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '500',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ltv: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  ltvLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.ink3,
  },
  repeatBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.goldTint,
  },
  repeatBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.goldDark,
  },
  emptyState: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
});
