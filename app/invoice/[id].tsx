import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CheckCircle, Pencil } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineItemEditor } from '@/components/quote/LineItemEditor';
import { Card } from '@/components/ui/Card';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { LineItem } from '@/lib/ai';
import { fetchCustomer, type CustomerRow } from '@/lib/customers';
import { impliedTaxRate, invoiceEditable, invoiceTotals } from '@/lib/invoice-math';
import { shareInvoicePdf } from '@/lib/invoice-pdf';
import {
  fetchInvoice,
  markInvoicePaid,
  sendInvoice,
  updateInvoiceTotals,
  type InvoiceRow,
  type InvoiceStatus,
} from '@/lib/invoices';
import { formatCents } from '@/lib/pricing';
import { fetchQuote } from '@/lib/quotes';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function InvoiceDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<LineItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const row = await fetchInvoice(id);
      setInvoice(row);
      if (row) {
        const [c, q] = await Promise.all([
          row.customer_id ? fetchCustomer(row.customer_id) : Promise.resolve(null),
          row.quote_id ? fetchQuote(row.quote_id) : Promise.resolve(null),
        ]);
        setCustomer(c);
        setScope(q?.scope_of_work ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  // Keep the tax rate the quote was priced at when actuals change.
  const taxRate = useMemo(
    () => (invoice ? impliedTaxRate(invoice.subtotal_cents, invoice.tax_cents) : 0),
    [invoice],
  );
  const draft = useMemo(() => invoiceTotals(draftItems, taxRate), [draftItems, taxRate]);

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
  const editable = invoiceEditable(invoice);
  const shown = editing ? draft : invoice;

  const handleSend = async () => {
    if (!customer?.email) {
      Alert.alert("Can't send", 'This invoice is missing a customer email.');
      return;
    }
    setSending(true);
    try {
      const result = await sendInvoice({
        invoice_id: invoice.id,
        recipient: { name: customer.name ?? null, email: customer.email },
      });
      setInvoice({ ...invoice, sent_at: result.sent_at });
      Alert.alert('Sent', `Invoice emailed to ${customer.email}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert("Couldn't send", message);
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareInvoicePdf(invoice, customer, scope);
    } catch (err) {
      Alert.alert("Couldn't make the PDF", err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  };

  const handleMarkPaid = () => {
    Alert.alert(
      'Mark as paid?',
      `Record ${formatCents(invoice.total_cents)} as received (cash, check or transfer). The job moves to Paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            setMarking(true);
            const updated = await markInvoicePaid(invoice);
            setMarking(false);
            if (updated) setInvoice(updated);
            else Alert.alert("Couldn't update", 'Please try again.');
          },
        },
      ],
    );
  };

  const startEdit = () => {
    setDraftItems(invoice.line_items);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (draft.line_items.length === 0) {
      Alert.alert('Add at least one line item');
      return;
    }
    setSavingEdit(true);
    const updated = await updateInvoiceTotals(invoice.id, draft);
    setSavingEdit(false);
    if (!updated) {
      Alert.alert("Couldn't save", 'The invoice may already have been sent.');
      return;
    }
    setInvoice(updated);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={10}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Invoice</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <StatusBadge status={invoice.status} />

          <Text style={styles.amount}>{formatCents(shown.total_cents)}</Text>
          <Text style={styles.amountSub}>
            {customer ? `for ${customer.name}` : 'Invoice'} · #{shortId(invoice.id)}
          </Text>

          <Card>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>{editing ? 'Actual costs' : 'Line items'}</Text>
              {editable && !editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit line items to actual costs"
                  onPress={startEdit}
                  hitSlop={14}
                  style={styles.editLink}
                >
                  <Pencil size={16} color={colors.goldDark} strokeWidth={2} />
                  <Text style={styles.editLabel}>Edit</Text>
                </Pressable>
              ) : null}
            </View>

            {editing ? (
              <>
                <Text style={styles.editHint}>
                  Change anything that differed from the quote before you send.
                  {taxRate > 0 ? ` Tax stays at ${taxRate}%.` : ''}
                </Text>
                <LineItemEditor items={draftItems} onChange={setDraftItems} />
              </>
            ) : (
              invoice.line_items.map((item, i) => (
                <View key={i} style={styles.lineItem}>
                  <Text style={styles.lineLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.lineAmount}>{formatCents(item.total_cents)}</Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalAmount}>{formatCents(shown.subtotal_cents)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalAmount}>{formatCents(shown.tax_cents)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandAmount}>{formatCents(shown.total_cents)}</Text>
            </View>
          </Card>

          {sent || paid ? (
            <Card>
              <View style={styles.inlineBadge}>
                <CheckCircle size={18} color={colors.success} strokeWidth={2} />
                <Text style={styles.sentLabel}>
                  {[
                    invoice.sent_at ? `Sent ${formatDate(invoice.sent_at)}` : null,
                    invoice.paid_at ? `Paid ${formatDate(invoice.paid_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {editing ? (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <GhostButton label="Cancel" onPress={() => setEditing(false)} style={styles.flex} />
            <PrimaryButton
              label={savingEdit ? 'Saving…' : 'Save actuals'}
              onPress={() => void saveEdit()}
              loading={savingEdit}
              disabled={savingEdit}
              style={styles.flex}
            />
          </View>
        </View>
      ) : !paid ? (
        <View style={styles.footer}>
          <PrimaryButton
            label={sending ? 'Sending…' : sent ? 'Resend invoice' : 'Send invoice'}
            onPress={handleSend}
            loading={sending}
            disabled={sending || !customer?.email}
          />
          {!customer?.email ? (
            <Text style={styles.footerHint}>
              Add an email to the customer to send, or share the PDF instead.
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            <GhostButton
              label={sharing ? 'Preparing…' : 'Share PDF'}
              onPress={() => void handleShare()}
              disabled={sharing}
              style={styles.flex}
            />
            <GhostButton
              label={marking ? 'Saving…' : 'Mark paid'}
              onPress={handleMarkPaid}
              disabled={marking}
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <View style={styles.footer}>
          <View style={styles.footerDone}>
            <CheckCircle size={18} color={colors.success} strokeWidth={2} />
            <Text style={styles.footerDoneLabel}>Paid in full</Text>
          </View>
          <GhostButton
            label={sharing ? 'Preparing…' : 'Share PDF receipt'}
            onPress={() => void handleShare()}
            disabled={sharing}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { label, bg, fg } = pillStyle(status, colors);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillStyle(
  status: InvoiceStatus,
  colors: Colors,
): { label: string; bg: string; fg: string } {
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface2 },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    loadingLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
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
    pillText: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
    },
    amount: {
      fontFamily: typography.fonts.numeric,
      fontSize: 40,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    amountSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginBottom: spacing.sm,
    },
    editLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 32,
    },
    editLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    editHint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      marginBottom: spacing.md,
    },
    lineItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    lineLabel: {
      fontFamily: typography.fonts.body,
      flex: 1,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    lineAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
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
    totalLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    totalAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    grandRow: {
      marginTop: spacing.sm,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: spacing.md,
    },
    grandLabel: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    grandAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    inlineBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sentLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.sm,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    footerHint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      textAlign: 'center',
    },
    footerDone: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    footerDoneLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.success,
    },
  });
