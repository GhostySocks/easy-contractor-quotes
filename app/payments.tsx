import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listInvoices, type InvoiceWithCustomer } from '@/lib/invoices';
import { daysOverdue, groupInvoices } from '@/lib/payments-math';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Kind = 'overdue' | 'unpaid' | 'paid';
type Section = { kind: Kind; title: string; totalCents: number; data: InvoiceWithCustomer[] };

/**
 * Payments (PRD IN-04): every invoice by what it needs from you. Overdue
 * first, then unpaid, then the last 30 days of payments. Reached from the
 * money card on Home rather than a fifth tab, which would break the
 * four-tabs-plus-FAB layout (CLAUDE.md §5).
 */
export default function PaymentsScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [rows, setRows] = useState<InvoiceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listInvoices());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const sections = useMemo<Section[]>(() => {
    const g = groupInvoices(rows);
    const all: Section[] = [
      { kind: 'overdue', title: 'Overdue', totalCents: g.totals.overdueCents, data: g.overdue },
      { kind: 'unpaid', title: 'Unpaid', totalCents: g.totals.unpaidCents, data: g.unpaid },
      {
        kind: 'paid',
        title: 'Paid · last 30 days',
        totalCents: g.totals.paidLast30Cents,
        data: g.paid,
      },
    ];
    return all.filter((s) => s.data.length > 0);
  }, [rows]);

  const outstanding = sections
    .filter((s) => s.kind !== 'paid')
    .reduce((n, s) => n + s.totalCents, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={12}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Payments</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>OUTSTANDING</Text>
              <Text style={styles.summaryAmount}>{formatCents(outstanding)}</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, section.kind === 'overdue' && styles.overdue]}>
                {section.title}
              </Text>
              <Text style={styles.sectionTotal}>{formatCents(section.totalCents)}</Text>
            </View>
          )}
          renderItem={({ item, section }) => <InvoiceRowItem invoice={item} kind={section.kind} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No invoices yet. Mark a job completed and its invoice shows up here.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function InvoiceRowItem({ invoice, kind }: { invoice: InvoiceWithCustomer; kind: Kind }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const meta =
    kind === 'overdue' && invoice.sent_at
      ? overdueLabel(invoice.sent_at)
      : kind === 'paid' && invoice.paid_at
        ? `Paid ${shortDate(invoice.paid_at)}`
        : invoice.sent_at
          ? `Sent ${shortDate(invoice.sent_at)}`
          : 'Not sent yet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${invoice.customer_name ?? 'Customer'}, ${formatCents(invoice.total_cents)}, ${meta}`}
      onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {invoice.customer_name ?? 'Customer'}
        </Text>
        <Text style={[styles.rowMeta, kind === 'overdue' && styles.overdue]}>{meta}</Text>
      </View>
      <Text style={[styles.rowAmount, kind === 'paid' && styles.paid]}>
        {formatCents(invoice.total_cents)}
      </Text>
      <ChevronRight size={18} color={colors.ink3} strokeWidth={2} />
    </Pressable>
  );
}

function overdueLabel(sentAt: string): string {
  const d = daysOverdue(sentAt);
  return d === 0 ? 'Overdue today' : `${d} day${d === 1 ? '' : 's'} overdue`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    list: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.huge,
      gap: spacing.sm,
    },
    summary: {
      paddingVertical: spacing.lg,
      gap: 2,
    },
    summaryLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      color: colors.ink3,
    },
    summaryAmount: {
      fontFamily: typography.fonts.numeric,
      fontSize: 40,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    sectionTitle: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    sectionTotal: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.body,
      color: colors.ink2,
      fontVariant: ['tabular-nums'],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 72,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    },
    pressed: { opacity: 0.7 },
    rowBody: { flex: 1, gap: 2 },
    rowName: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    rowMeta: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    rowAmount: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    overdue: { color: colors.danger },
    paid: { color: colors.success },
    empty: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink3,
      textAlign: 'center',
      paddingVertical: spacing.huge,
    },
  });
