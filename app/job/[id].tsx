import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  FileText,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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

import { JobNotes } from '@/components/job/JobNotes';
import { JobPhotos } from '@/components/job/JobPhotos';
import { JobTimeline } from '@/components/job/JobTimeline';
import { Card } from '@/components/ui/Card';
import { DateSheet } from '@/components/ui/DateSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { LineItem } from '@/lib/ai';
import { fetchContractByJob, type ContractRow } from '@/lib/contracts';
import { fetchCustomer, type CustomerRow } from '@/lib/customers';
import { createInvoiceFromQuote, fetchInvoiceByJob, type InvoiceRow } from '@/lib/invoices';
import { confirmScheduleSlot } from '@/lib/availability';
import { addJobToPhoneCalendar } from '@/lib/calendar-export';
import { buildTimeline } from '@/lib/job-timeline';
import { syncJobReminders } from '@/lib/notifications';
import {
  fetchJob,
  markJobCompleted,
  markJobInProgress,
  setJobSchedule,
  setJobStatus,
  updateJobDetails,
  type JobRow,
} from '@/lib/jobs';
import { formatCents } from '@/lib/pricing';
import { fetchQuote, type QuoteRow } from '@/lib/quotes';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function JobDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job, setJob] = useState<JobRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
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
          setInvoice(invoiceRow);
        }

        setLoading(false);
      })();
    }, [id]),
  );

  const jobId = job?.id;

  // Keep this job's reminder in step with every schedule or status change
  // made here (reschedule, unschedule, start, cancel, reopen, complete).
  const jobStatus = job?.status;
  const jobScheduledAt = job?.scheduled_at;
  const jobTitle = job?.title;
  const customerName = customer?.name;
  useEffect(() => {
    if (!jobId || !jobStatus || !jobTitle) return;
    void syncJobReminders(
      [
        {
          id: jobId,
          status: jobStatus,
          scheduled_at: jobScheduledAt ?? null,
          title: jobTitle,
          customer_name: customerName,
        },
      ],
      new Set([jobId]),
    );
  }, [jobId, jobStatus, jobScheduledAt, jobTitle, customerName]);

  const handlePhotosChange = useCallback(
    async (photos: string[]) => {
      if (!jobId) return false;
      const updated = await updateJobDetails(jobId, { photos });
      if (updated) setJob(updated);
      return updated !== null;
    },
    [jobId],
  );

  const handleNotesSave = useCallback(
    async (notes: string | null) => {
      if (!jobId) return false;
      // Don't replace the job in state: the notes field owns its own text.
      return (await updateJobDetails(jobId, { notes })) !== null;
    },
    [jobId],
  );

  const handleCancel = useCallback(() => {
    if (!job) return;
    Alert.alert('Cancel this job?', 'It moves out of your active jobs. You can reopen it later.', [
      { text: 'Keep job', style: 'cancel' },
      {
        text: 'Cancel job',
        style: 'destructive',
        onPress: async () => {
          const updated = await setJobStatus(job, 'cancel');
          if (updated) setJob(updated);
          else Alert.alert("Couldn't cancel", 'Please try again.');
        },
      },
    ]);
  }, [job]);

  const handleReopen = useCallback(async () => {
    if (!job) return;
    const updated = await setJobStatus(job, 'reopen');
    if (updated) setJob(updated);
    else Alert.alert("Couldn't reopen", 'Please try again.');
  }, [job]);

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
      // Warn about other jobs (with travel time) or blocked time first; the
      // sheet stays open if the contractor picks another time.
      if (!(await confirmScheduleSlot(iso, job.id))) return;
      const updated = await setJobSchedule(job.id, iso);
      setSchedulerOpen(false);
      if (updated) setJob(updated);
    },
    [job],
  );

  const handleUnschedule = useCallback(async () => {
    if (!job) return;
    const updated = await setJobSchedule(job.id, null);
    setSchedulerOpen(false);
    if (updated) setJob(updated);
  }, [job]);

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
  const cancelled = job.status === 'cancelled';
  const inProgress = job.status === 'in_progress';
  const scheduleEditable = !completed && !cancelled;
  const timeline = buildTimeline({ job, contract, invoice });

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

        {job.scheduled_at && !cancelled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add this job to my phone calendar"
            onPress={() =>
              void addJobToPhoneCalendar({
                title: job.title,
                scheduled_at: job.scheduled_at as string,
                description: job.description,
                customerName: customer?.name ?? null,
                address: customer
                  ? [customer.address_line1, customer.city, customer.state_code]
                      .filter(Boolean)
                      .join(', ') || null
                  : null,
              }).catch(() =>
                Alert.alert(
                  "Couldn't open your calendar",
                  'Add it from your calendar app instead.',
                ),
              )
            }
            hitSlop={8}
            style={({ pressed }) => [styles.calendarLink, pressed && styles.linkCardPressed]}
          >
            <CalendarPlus size={18} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.calendarLabel}>Add to my calendar</Text>
          </Pressable>
        ) : null}

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

        <JobPhotos paths={job.photos ?? []} onChange={handlePhotosChange} />
        <JobNotes initial={job.notes} onSave={handleNotesSave} />
        <JobTimeline events={timeline} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quote this job again"
          onPress={() =>
            router.push({
              pathname: '/quote/new',
              params: {
                fromJobId: job.id,
                ...(job.customer_id ? { customerId: job.customer_id } : {}),
              },
            })
          }
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
        >
          <RotateCcw size={20} color={colors.goldDark} strokeWidth={2} />
          <View style={styles.linkCardText}>
            <Text style={styles.linkCardTitle}>Quote again</Text>
            <Text style={styles.linkCardSub}>Start a new quote from this job</Text>
          </View>
          <Text style={styles.linkCardChevron}>›</Text>
        </Pressable>

        {!completed && !cancelled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel this job"
            onPress={handleCancel}
            hitSlop={8}
            style={({ pressed }) => [styles.cancelLink, pressed && styles.linkCardPressed]}
          >
            <Ban size={18} color={colors.danger} strokeWidth={2} />
            <Text style={styles.cancelLabel}>Cancel job</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {cancelled ? (
        <View style={styles.footer}>
          <PrimaryButton label="Reopen job" onPress={() => void handleReopen()} />
        </View>
      ) : !completed ? (
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
      ) : invoice ? (
        <View style={styles.footer}>
          <PrimaryButton
            label={invoice.status === 'paid' ? 'View invoice · Paid' : 'View invoice'}
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })}
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

      <DateSheet
        visible={schedulerOpen}
        title="Schedule job"
        currentIso={job.scheduled_at}
        onClose={() => setSchedulerOpen(false)}
        onPick={(iso) => void handlePickDate(iso)}
        clearLabel={job.scheduled_at ? 'Unschedule this job' : undefined}
        onClear={() => void handleUnschedule()}
      />
    </SafeAreaView>
  );
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

function StatusPill({ status }: { status: JobRow['status'] }) {
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
  status: JobRow['status'],
  colors: Colors,
): { label: string; bg: string; fg: string } {
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface2 },
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
    jobTitle: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.ink,
      marginTop: spacing.sm,
    },
    customer: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
      marginTop: 2,
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
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginBottom: spacing.sm,
    },
    line: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
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
    cancelLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 60,
    },
    cancelLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.danger,
    },
    linkCardPressed: { opacity: 0.75 },
    linkCardText: { flex: 1 },
    linkCardTitle: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    linkCardSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.label,
      color: colors.ink3,
      marginTop: 2,
    },
    linkCardChevron: {
      fontFamily: typography.fonts.body,
      fontSize: 28,
      color: colors.ink3,
    },
    scopeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    openLink: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.goldDark,
    },
    scope: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
    lineItems: { gap: spacing.xs, marginTop: spacing.md },
    lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
    lineItemLabel: {
      fontFamily: typography.fonts.body,
      flex: 1,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    lineItemAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: spacing.md,
    },
    totalLabel: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    totalAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
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
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.success,
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
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.ink3,
    },
    scheduleValue: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    calendarLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      marginTop: -spacing.sm,
    },
    calendarLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    scheduleAction: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.goldDark,
      letterSpacing: 0.4,
    },
  });
