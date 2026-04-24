import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CheckCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { fetchCustomer, type CustomerRow } from '@/lib/customers';
import { fetchInvoice, type InvoiceRow, type InvoiceStatus } from '@/lib/invoices';
import { formatCents } from '@/lib/pricing';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const row = await fetchInvoice(id);
      setInvoice(row);
      if (row?.customer_id) {
        const c = await fetchCustomer(row.customer_id);
        setCustomer(c);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingLabel}>Loading invoice…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.loadingLabel}>Invoice not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sent = !!invoice.sent_at;
  const paid = invoice.status === 'paid';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Invoice</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusBadge status={invoice.status} />

        <Text style={styles.amount}>{formatCents(invoice.total_cents)}</Text>
        <Text style={styles.amountSub}>
          {customer ? `for ${customer.name}` : 'Invoice'} · #{shortId(invoice.id)}
        </Text>

        <Card>
          <Text style={styles.sectionLabel}>Line items</Text>
          {invoice.line_items.map((item, i) => (
            <View key={i} style={styles.lineItem}>
              <Text style={styles.lineLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.lineAmount}>{formatCents(item.total_cents)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalAmount}>{formatCents(invoice.subtotal_cents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalAmount}>{formatCents(invoice.tax_cents)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandAmount}>{formatCents(invoice.total_cents)}</Text>
          </View>
        </Card>

        {sent ? (
          <Card>
            <View style={styles.inlineBadge}>
              <CheckCircle size={18} color={colors.success} strokeWidth={2} />
              <Text style={styles.sentLabel}>
                Sent {formatDate(invoice.sent_at!)}
                {invoice.paid_at ? ` · Paid ${formatDate(invoice.paid_at)}` : ''}
              </Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {!paid ? (
        <View style={styles.footer}>
          <PrimaryButton
            label={sent ? 'Resend invoice' : 'Send invoice'}
            onPress={() =>
              Alert.alert('Send invoice', 'Wiring Resend in M1e-6. Button is the real CTA.')
            }
          />
        </View>
      ) : (
        <View style={styles.footerDone}>
          <CheckCircle size={18} color={colors.success} strokeWidth={2} />
          <Text style={styles.footerDoneLabel}>Paid in full</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, bg, fg } = pillStyle(status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillStyle(status: InvoiceStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'paid':
      return { label: 'PAID', bg: colors.surface2, fg: colors.success };
    case 'partial':
      return { label: 'PARTIAL', bg: colors.goldTint, fg: colors.goldDark };
    case 'refunded':
      return { label: 'REFUNDED', bg: colors.surface2, fg: colors.ink2 };
    case 'unpaid':
    default:
      return { label: 'UNPAID', bg: colors.goldTint, fg: colors.goldDark };
  }
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingLabel: { fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  amountSub: { fontSize: typography.sizes.bodySmall, color: colors.ink3 },
  sectionLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
    marginBottom: spacing.sm,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  lineLabel: { flex: 1, fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  lineAmount: { fontSize: typography.sizes.bodySmall, color: colors.ink, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: { fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  totalAmount: { fontSize: typography.sizes.bodySmall, color: colors.ink, fontWeight: '600' },
  grandRow: {
    marginTop: spacing.sm,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  grandLabel: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  grandAmount: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  inlineBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sentLabel: { fontSize: typography.sizes.bodySmall, color: colors.ink2, fontWeight: '600' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface2,
  },
  footerDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface2,
  },
  footerDoneLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.success,
    fontWeight: '700',
  },
});
