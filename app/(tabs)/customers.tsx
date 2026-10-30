import { router, useFocusEffect } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { collectTags, hasTag } from '@/lib/customer-form';
import { listCustomers, type CustomerWithJobs } from '@/lib/customers';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function CustomersScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [customers, setCustomers] = useState<CustomerWithJobs[]>([]);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
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

  // Refresh quietly when coming back from a profile or edit screen, so edited
  // names and tags show without a pull-to-refresh. Skips the first focus,
  // which the effect above already covers.
  const focusedOnce = useRef(false);
  const searchRef = useRef(search);
  searchRef.current = search;
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void load(searchRef.current);
      focusedOnce.current = true;
    }, [load]),
  );

  const tags = useMemo(() => collectTags(customers), [customers]);
  // A tag that no longer exists (renamed or removed) stops filtering.
  const activeTag = tag && tags.some((t) => t.toLowerCase() === tag.toLowerCase()) ? tag : null;
  const visible = useMemo(
    () => (activeTag ? customers.filter((c) => hasTag(c, activeTag)) : customers),
    [customers, activeTag],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.count}>
            {visible.length} {visible.length === 1 ? 'person' : 'people'}
          </Text>
        </View>

        <SearchField value={search} onChangeText={setSearch} />

        {tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip label="All" selected={activeTag === null} onPress={() => setTag(null)} />
            {tags.map((t) => (
              <Chip
                key={t}
                label={t}
                selected={activeTag?.toLowerCase() === t.toLowerCase()}
                onPress={() => setTag(activeTag?.toLowerCase() === t.toLowerCase() ? null : t)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={visible}
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
              {search || activeTag
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
  const styles = useStyles(makeStyles);
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
  const styles = useStyles(makeStyles);
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
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.display,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    count: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    tagRow: {
      gap: spacing.sm,
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
      fontFamily: typography.fonts.body,
      flex: 1,
      fontSize: typography.sizes.body,
      color: colors.ink,
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
      fontFamily: typography.fonts.bodyStrong,
      flexShrink: 1,
      fontSize: typography.sizes.body,
      color: colors.ink,
      lineHeight: 22,
    },
    sub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    rightCol: {
      alignItems: 'flex-end',
      gap: 2,
    },
    ltv: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    ltvLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
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
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.goldDark,
    },
    emptyState: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      paddingVertical: spacing.huge,
      paddingHorizontal: spacing.lg,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
