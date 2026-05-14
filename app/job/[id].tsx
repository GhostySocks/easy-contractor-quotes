import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, ChevronLeft, FileText, ShieldCheck, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { LineItem } from '@/lib/ai';
import { fetchContractByJob, type ContractRow } from '@/lib/contracts';
import { fetchCustomer, type CustomerRow } from '@/lib/customers';
import { createInvoiceFromQuote, fetchInvoiceByJob } from '@/lib/invoices';
import {
  fetchJob,
  markJobCompleted,
  markJobInProgress,
  setJobSchedule,
  type JobRow,
} from '@/lib/jobs';
import { formatCents } from '@/lib/pricing';
import { fetchQuote, type QuoteRow } from '@/lib/quotes';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job, setJob] = useState<JobRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const jobRow = await fetchJob(id);
      setJob(jobRow);

      if (jobRow) {
        const contractRow = await fetchContractByJob(jobRow.id);
        setContract(contractRow);

        const [customerRow, quoteRow, invoiceRow] = await Promise.all([
          jobRow.customer_id ? fetchCustomer(jobRow.customer_id) : Promise.resolve(null),
          contractRow?.quote_id ? fetchQuote(contractRow.quote_id) : Promise.resolve(null),
          fetchInvoiceByJob(jobRow.id),
        ]);
        setCustomer(customerRow);
        setQuote(quoteRow);
        setInvoiceId(invoiceRow?.id ?? null);
      }

      setLoading(false);
    })();
  }, [id]);

  const handleStart = useCallback(async () => {
    if (!job) return;
    setStarting(true);
    try {
      const updated = await markJobInProgress(job.id);
      if (!updated) {
        Alert.alert("Couldn't start job", 'Please try again.');
        return;
      }
      setJob(updated);
    } finally {
      setStarting(false);
    }
  }, [job]);

  const handlePickDate = useCallback(
    async (iso: string) => {
      if (!job) return;
      // Pick 9:00 AM local on the chosen day; time picker is a follow-up.
      const [y, m, d] = iso.split('-').map(Number);
      const scheduledAt = new Date(y, m - 1, d, 9, 0, 0).toISOString();
      const updated = await setJobSchedule(job.id, scheduledAt);
      setSchedulerOpen(false);
      if (updated) setJob(updated);
    },
    [job],
  );

  const handleComplete = useCallback(async () => {
    if (!job || !quote) {
      Alert.alert("Can't complete", 'This job is missing its quote.');
      return;
    }
    setCompleting(true);
    try {
      const updated = await markJobCompleted(job.id);
      if (!updated) {
        Alert.alert("Couldn't complete", 'Please try again.');
        return;
      }
      setJob(updated);

      const invoice = await createInvoiceFromQuote({
        user_id: updated.user_id,
        job_id: updated.id,
        customer_id: updated.customer_id,
        quote_id: quote.id,
        line_items: (quote.line_items ?? []) as LineItem[],
        subtotal_cents: quote.subtotal_cents,
        tax_cents: quote.tax_cents,
        total_cents: quote.total_cents,
      });
      if (!invoice) {
        Alert.alert(
          'Job completed',
          "Invoice couldn't be generated right now — open the job again to retry.",
        );
        return;
      }
      router.replace({ pathname: '/invoice/[id]', params: { id: invoice.id } });
    } finally {
      setCompleting(false);
    }
  }, [job, quote]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingLabel}>Loading job…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.loadingLabel}>Job not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items: LineItem[] = (quote?.line_items as LineItem[]) ?? [];
  const completed = job.status === 'completed' || job.status === 'paid';
  const inProgress = job.status === 'in_progress';
  const scheduleEditable = !completed;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Job</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <StatusPill status={job.status} />
          <Text style={styles.jobTitle}>{job.title}</Text>
          {customer ? <Text style={styles.customer}>{customer.name}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            job.scheduled_at
              ? `Scheduled for ${formatDate(job.scheduled_at)}. Tap to change.`
              : 'Not scheduled. Tap to schedule.'
          }
          onPress={scheduleEditable ? () => setSchedulerOpen(true) : undefined}
          disabled={!scheduleEditable}
          style={({ pressed }) => [
            styles.scheduleCard,
            pressed && scheduleEditable && styles.scheduleCardPressed,
          ]}
        >
          <View style={styles.scheduleIcon}>
            <CalendarClock size={20} color={colors.goldDark} strokeWidth={2} />
          </View>
          <View style={styles.scheduleBody}>
            <Text style={styles.scheduleLabel}>SCHEDULED</Text>
            <Text style={styles.scheduleValue}>
              {job.scheduled_at ? formatDateWithTime(job.scheduled_at) : 'Not scheduled yet'}
            </Text>
          </View>
          {scheduleEditable ? <Text style={styles.scheduleAction}>Change</Text> : null}
        </Pressable>

        {customer ? (
          <Card>
            <Text style={styles.sectionLabel}>Customer</Text>
            {customer.phone ? <Text style={styles.line}>{customer.phone}</Text> : null}
            {customer.email ? <Text style={styles.line}>{customer.email}</Text> : null}
            {customer.address_line1 ? (
              <Text style={styles.line}>
                {[customer.address_line1, customer.city, customer.state_code]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {contract ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/contract/[id]', params: { id: contract.id } })}
            style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          >
            <ShieldCheck
              size={20}
              color={contract.signed_at ? colors.success : colors.gold}
              strokeWidth={2}
            />
            <View style={styles.linkCardText}>
              <Text style={styles.linkCardTitle}>
                {contract.kind === 'release' ? 'Release of liability' : 'Work agreement'}
              </Text>
              <Text style={styles.linkCardSub}>
                {contract.signed_at ? 'Signed' : 'Awaiting signature'}
              </Text>
            </View>
            <Text style={styles.linkCardChevron}>›</Text>
          </Pressable>
        ) : null}

        {quote ? (
          <Card>
            <View style={styles.scopeHeader}>
              <Text style={styles.sectionLabel}>Scope of work</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/quote/[id]', params: { id: quote.id } })}
                hitSlop={8}
              >
                <Text style={styles.openLink}>Open quote →</Text>
              </Pressable>
            </View>
            {quote.scope_of_work ? <Text style={styles.scope}>{quote.scope_of_work}</Text> : null}
            <View style={styles.lineItems}>
              {items.map((item, i) => (
                <View key={i} style={styles.lineItem}>
                  <Text style={styles.lineItemLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.lineItemAmount}>{formatCents(item.total_cents)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{formatCents(job.total_cents ?? 0)}</Text>
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={styles.sectionLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCents(job.total_cents ?? 0)}</Text>
          </Card>
        )}
      </ScrollView>

      {!completed ? (
        <View style={styles.footer}>
          {inProgress ? (
            <PrimaryButton
              label={completing ? 'Marking complete…' : 'Mark completed'}
              onPress={handleComplete}
              loading={completing}
              disabled={completing}
            />
          ) : (
            <PrimaryButton
              label={starting ? 'Starting…' : 'Start job'}
              onPress={handleStart}
              loading={starting}
              disabled={starting}
            />
          )}
        </View>
      ) : invoiceId ? (
        <View style={styles.footer}>
          <PrimaryButton
            label="View invoice"
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoiceId } })}
          />
        </View>
      ) : (
        <View style={styles.footerDone}>
          <FileText size={18} color={colors.success} strokeWidth={2} />
          <Text style={styles.footerDoneLabel}>
            Completed{job.completed_at ? ` · ${formatDate(job.completed_at)}` : ''}
          </Text>
        </View>
      )}

      <ScheduleSheet
        visible={schedulerOpen}
        currentIso={job.scheduled_at}
        onClose={() => setSchedulerOpen(false)}
        onPick={(iso) => void handlePickDate(iso)}
      />
    </SafeAreaView>
  );
}

function ScheduleSheet({
  visible,
  currentIso,
  onClose,
  onPick,
}: {
  visible: boolean;
  currentIso: string | null;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const currentDay = currentIso ? isoDay(new Date(currentIso)) : isoDay(new Date());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Pick a date</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.sheetClose}
                >
                  <X size={20} color={colors.ink2} strokeWidth={2} />
                </Pressable>
              </View>
              <Calendar
                current={currentDay}
                onDayPress={(d: DateData) => onPick(d.dateString)}
                markedDates={{
                  [currentDay]: {
                    selected: true,
                    selectedColor: colors.ink,
                    selectedTextColor: colors.gold,
                  },
                }}
                firstDay={0}
                theme={sheetCalendarTheme}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateWithTime(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

const sheetCalendarTheme = {
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  selectedDayBackgroundColor: colors.ink,
  selectedDayTextColor: colors.gold,
  todayTextColor: colors.goldDark,
  arrowColor: colors.ink,
  monthTextColor: colors.ink,
  textMonthFontWeight: '800' as const,
};

function StatusPill({ status }: { status: JobRow['status'] }) {
  const { label, bg, fg } = pillStyle(status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillStyle(status: JobRow['status']): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'in_progress':
      return { label: 'IN PROGRESS', bg: colors.goldTint, fg: colors.goldDark };
    case 'scheduled':
      return { label: 'SCHEDULED', bg: colors.surface2, fg: colors.ink2 };
    case 'completed':
      return { label: 'COMPLETED', bg: colors.surface2, fg: colors.success };
    case 'paid':
      return { label: 'PAID', bg: colors.surface2, fg: colors.success };
    case 'cancelled':
      return { label: 'CANCELLED', bg: colors.surface2, fg: colors.danger };
    default:
      return { label: status.toUpperCase(), bg: colors.surface2, fg: colors.ink2 };
  }
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
  jobTitle: {
    fontSize: typography.sizes.h1,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  customer: { fontSize: typography.sizes.bodySmall, color: colors.ink2, marginTop: 2 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  sectionLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
    marginBottom: spacing.sm,
  },
  line: { fontSize: typography.sizes.bodySmall, color: colors.ink, lineHeight: 22 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
  },
  linkCardPressed: { opacity: 0.75 },
  linkCardText: { flex: 1 },
  linkCardTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '700', color: colors.ink },
  linkCardSub: { fontSize: typography.sizes.label, color: colors.ink3, marginTop: 2 },
  linkCardChevron: { fontSize: 28, color: colors.ink3, fontWeight: '300' },
  scopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openLink: { fontSize: typography.sizes.label, fontWeight: '700', color: colors.goldDark },
  scope: { fontSize: typography.sizes.bodySmall, color: colors.ink, lineHeight: 22 },
  lineItems: { gap: spacing.xs, marginTop: spacing.md },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  lineItemLabel: { flex: 1, fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  lineItemAmount: { fontSize: typography.sizes.bodySmall, color: colors.ink, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  totalLabel: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  totalAmount: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
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
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
  },
  scheduleCardPressed: { opacity: 0.7 },
  scheduleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBody: { flex: 1, gap: 2 },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.ink3,
  },
  scheduleValue: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.ink,
  },
  scheduleAction: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    color: colors.goldDark,
    letterSpacing: 0.4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
