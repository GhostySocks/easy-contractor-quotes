import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TodayJobRow,
  type JobStatus as RowStatus,
  type TodayJob,
} from '@/components/ui/TodayJobRow';
import { listAllJobs, type JobWithCustomer, type LibraryStatusFilter } from '@/lib/jobs';
import { listDraftQuotes, type DraftQuoteWithCustomer } from '@/lib/quotes';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

// Unified row shape so we can group + render jobs and draft quotes through
// the same SectionList without separate code paths per source.
type LibraryRow = {
  id: string;
  href: '/job/[id]' | '/quote/[id]';
  groupingIso: string;
  todayJob: TodayJob;
};

type Section = { title: string; data: LibraryRow[] };

const FILTERS: { key: LibraryStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
  { key: 'drafts', label: 'Drafts' },
];

export default function JobsScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [filter, setFilter] = useState<LibraryStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (status: LibraryStatusFilter, query: string) => {
    if (status === 'drafts') {
      const drafts = await listDraftQuotes();
      const filtered = query
        ? drafts.filter(
            (d) =>
              (d.scope_of_work ?? '').toLowerCase().includes(query.toLowerCase()) ||
              (d.customer_name ?? '').toLowerCase().includes(query.toLowerCase()),
          )
        : drafts;
      setRows(filtered.map(draftToRow));
    } else {
      const jobs = await listAllJobs({ status, search: query });
      setRows(jobs.map(jobToRow));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load(filter, search).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filter, search, load]);

  const sections = useMemo(() => groupByDay(rows), [rows]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.count}>
            {rows.length} {countNoun(filter, rows.length)}
          </Text>
        </View>

        <SearchField value={search} onChangeText={setSearch} />

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <FilterPill
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderLabel}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TodayJobRow
            job={item.todayJob}
            onPress={() => router.push({ pathname: item.href, params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(filter, search);
              setRefreshing(false);
            }}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          loading ? null : <Text style={styles.emptyState}>{emptyLabel(filter, search)}</Text>
        }
      />
    </SafeAreaView>
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
        placeholder="Search by job or customer"
        placeholderTextColor={colors.ink3}
        style={styles.searchInput}
        returnKeyType="search"
        autoCapitalize="none"
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

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Group rows by the date their `groupingIso` falls on. Sections come out in
 * the same order as the input (newest first), so we rely on the caller's
 * ordering rather than re-sorting here.
 */
function groupByDay(rows: LibraryRow[]): Section[] {
  const sections: Section[] = [];
  const seen = new Map<string, Section>();

  for (const row of rows) {
    const key = bucketKey(row.groupingIso);
    let section = seen.get(key);
    if (!section) {
      section = { title: formatBucketLabel(key), data: [] };
      seen.set(key, section);
      sections.push(section);
    }
    section.data.push(row);
  }
  return sections;
}

function bucketKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatBucketLabel(key: string): string {
  if (key === 'unknown') return 'Unscheduled';

  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m, d);
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function jobToRow(row: JobWithCustomer): LibraryRow {
  const status: RowStatus =
    row.status === 'in_progress'
      ? 'in_progress'
      : row.status === 'completed' || row.status === 'paid'
        ? 'completed'
        : 'scheduled';
  return {
    id: row.id,
    href: '/job/[id]',
    groupingIso: row.scheduled_at ?? row.created_at,
    todayJob: {
      id: row.id,
      title: row.title,
      customerName: row.customer_name ?? 'Customer',
      meta: metaForStatus(row.status),
      status,
      amountCents: row.total_cents ?? 0,
    },
  };
}

function draftToRow(row: DraftQuoteWithCustomer): LibraryRow {
  return {
    id: row.id,
    href: '/quote/[id]',
    groupingIso: row.created_at,
    todayJob: {
      id: row.id,
      title: draftTitle(row.scope_of_work),
      customerName: row.customer_name ?? 'No customer',
      meta: 'Draft',
      status: 'draft',
      amountCents: row.total_cents ?? 0,
    },
  };
}

function draftTitle(scope: string | null): string {
  if (!scope) return 'Untitled draft';
  // First sentence-ish — up to first newline or ~60 chars, whichever comes first.
  const firstLine = scope.split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled draft';
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
}

function countNoun(filter: LibraryStatusFilter, n: number): string {
  if (filter === 'drafts') return n === 1 ? 'draft' : 'drafts';
  return n === 1 ? 'job' : 'jobs';
}

function emptyLabel(filter: LibraryStatusFilter, search: string): string {
  if (filter === 'drafts') {
    return search
      ? 'No drafts match this search.'
      : 'No draft quotes yet. Tap the gold button to start one.';
  }
  if (search || filter !== 'all') return 'No jobs match this filter.';
  return strings.locked.emptyJobs;
}

function metaForStatus(status: JobWithCustomer['status']): string {
  switch (status) {
    case 'in_progress':
      return 'Active';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
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
    filterRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    pill: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    pillActive: {
      backgroundColor: colors.selection,
      borderColor: colors.selectionBorder,
    },
    pillLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    pillLabelActive: {
      color: colors.gold,
    },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.huge + spacing.huge,
    },
    sectionHeader: {
      backgroundColor: colors.surface2,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    sectionHeaderLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.ink3,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
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
