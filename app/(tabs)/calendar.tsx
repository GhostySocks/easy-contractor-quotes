import { router } from 'expo-router';
import { CalendarPlus, Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

import {
  TodayJobRow,
  type JobStatus as RowStatus,
  type TodayJob,
} from '@/components/ui/TodayJobRow';
import {
  listJobsByDateRange,
  listUnscheduledJobs,
  setJobSchedule,
  type JobWithCustomer,
} from '@/lib/jobs';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function CalendarScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => isoDay(new Date()));
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch a buffered window around the visible month so navigation between
  // adjacent months is instant after the first paint of the new range.
  const load = useCallback(async (month: Date) => {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 2, 0, 23, 59, 59);
    const rows = await listJobsByDateRange(from.toISOString(), to.toISOString());
    setJobs(rows);
  }, []);

  useEffect(() => {
    void load(visibleMonth);
  }, [visibleMonth, load]);

  async function handlePick(job: JobWithCustomer) {
    // Default to 9:00 AM local on the selected day — time picker is a follow-up.
    const [y, m, d] = selectedDay.split('-').map(Number);
    const scheduledAt = new Date(y, m - 1, d, 9, 0, 0).toISOString();
    const updated = await setJobSchedule(job.id, scheduledAt);
    setPickerOpen(false);
    if (updated) {
      // Optimistically merge the new scheduled_at into our local list so the
      // dot + day-list update without a full reload.
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== job.id);
        next.push({ ...job, ...updated, customer_name: job.customer_name });
        return next;
      });
    }
  }

  const markedDates = useMemo(
    () => buildMarkedDates(jobs, selectedDay, colors),
    [jobs, selectedDay, colors],
  );
  const dayJobs = useMemo(() => jobs.filter((j) => dayOf(j) === selectedDay), [jobs, selectedDay]);

  const selectedDate = new Date(`${selectedDay}T00:00:00`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>Tap a day to see what&apos;s scheduled.</Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDay}
            onDayPress={(d: DateData) => setSelectedDay(d.dateString)}
            onMonthChange={(d: DateData) => setVisibleMonth(new Date(d.year, d.month - 1, 1))}
            firstDay={0}
            enableSwipeMonths
            markedDates={markedDates}
            theme={calendarThemeFor(colors)}
          />
        </View>

        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>{formatDayHeader(selectedDate)}</Text>
            <Text style={styles.dayCount}>
              {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
            </Text>
          </View>

          {dayJobs.length === 0 ? (
            <Text style={styles.emptyState}>Nothing on the books for this day.</Text>
          ) : (
            <View style={styles.jobsList}>
              {dayJobs.map((row) => (
                <TodayJobRow
                  key={row.id}
                  job={toTodayJob(row)}
                  onPress={() => router.push({ pathname: '/job/[id]', params: { id: row.id } })}
                />
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Schedule a job for this day"
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.scheduleCta, pressed && styles.scheduleCtaPressed]}
          >
            <CalendarPlus size={20} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.scheduleCtaLabel}>Schedule a job for this day</Text>
          </Pressable>
        </View>
      </ScrollView>

      <UnscheduledPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </SafeAreaView>
  );
}

function UnscheduledPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (job: JobWithCustomer) => void | Promise<void>;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void listUnscheduledJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, [visible]);

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
                <Text style={styles.sheetTitle}>Pick a job to schedule</Text>
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

              <ScrollView contentContainerStyle={styles.sheetScroll}>
                {loading ? null : jobs.length === 0 ? (
                  <View style={styles.sheetEmpty}>
                    <Text style={styles.sheetEmptyTitle}>No unscheduled jobs.</Text>
                    <Text style={styles.sheetEmptySub}>
                      Quote a new job from the gold button to add one.
                    </Text>
                  </View>
                ) : (
                  jobs.map((job) => (
                    <Pressable
                      key={job.id}
                      accessibilityRole="button"
                      onPress={() => void onPick(job)}
                      style={({ pressed }) => [styles.pickRow, pressed && styles.pickRowPressed]}
                    >
                      <View style={styles.pickIcon}>
                        <Plus size={18} color={colors.goldDark} strokeWidth={2.5} />
                      </View>
                      <View style={styles.pickBody}>
                        <Text style={styles.pickTitle} numberOfLines={1}>
                          {job.title}
                        </Text>
                        <Text style={styles.pickSub} numberOfLines={1}>
                          {job.customer_name ?? 'No customer'} · {job.status}
                        </Text>
                      </View>
                      <Text style={styles.pickAmount}>{formatCents(job.total_cents ?? 0)}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function buildMarkedDates(
  jobs: JobWithCustomer[],
  selectedDay: string,
  colors: Colors,
): Record<string, MarkedDate> {
  const marks: Record<string, MarkedDate> = {};
  for (const job of jobs) {
    const day = dayOf(job);
    if (!day) continue;
    marks[day] = { marked: true, dotColor: colors.gold };
  }
  marks[selectedDay] = {
    ...(marks[selectedDay] ?? {}),
    selected: true,
    selectedColor: colors.selection,
    selectedTextColor: colors.gold,
  };
  return marks;
}

type MarkedDate = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
};

function dayOf(job: JobWithCustomer): string {
  if (!job.scheduled_at) return '';
  return isoDay(new Date(job.scheduled_at));
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDayHeader(d: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const longForm = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (diff === 0) return `Today · ${longForm}`;
  if (diff === 1) return `Tomorrow · ${longForm}`;
  if (diff === -1) return `Yesterday · ${longForm}`;
  return longForm;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toTodayJob(row: JobWithCustomer): TodayJob {
  const date = row.scheduled_at ? new Date(row.scheduled_at) : null;
  const hours = date?.getHours() ?? null;
  const time =
    date && hours !== null
      ? {
          time: `${String(((hours + 11) % 12) + 1)}:${String(date.getMinutes()).padStart(2, '0')}`,
          meridiem: hours >= 12 ? ('PM' as const) : ('AM' as const),
        }
      : null;

  const status: RowStatus =
    row.status === 'in_progress'
      ? 'in_progress'
      : row.status === 'completed' || row.status === 'paid'
        ? 'completed'
        : 'scheduled';

  return {
    id: row.id,
    title: row.title,
    customerName: row.customer_name ?? 'Customer',
    meta: row.status,
    status,
    amountCents: row.total_cents ?? 0,
    ...(time ?? {}),
  };
}

const calendarThemeFor = (colors: Colors) => ({
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  textSectionTitleColor: colors.ink3,
  selectedDayBackgroundColor: colors.selection,
  selectedDayTextColor: colors.gold,
  todayTextColor: colors.goldDark,
  dayTextColor: colors.ink,
  textDisabledColor: colors.divider,
  arrowColor: colors.ink,
  monthTextColor: colors.ink,
  textMonthFontWeight: '800' as const,
  textDayFontWeight: '600' as const,
  textDayHeaderFontWeight: '800' as const,
  textMonthFontSize: 18,
  textDayFontSize: 16,
  textDayHeaderFontSize: 12,
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    scroll: {
      padding: spacing.xl,
      paddingBottom: spacing.huge + spacing.huge,
      gap: spacing.xl,
    },
    header: {
      gap: spacing.xs,
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.display,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      overflow: 'hidden',
    },
    daySection: {
      gap: spacing.md,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    dayLabel: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
      flexShrink: 1,
    },
    dayCount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    jobsList: {
      gap: spacing.md,
    },
    emptyState: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      paddingVertical: spacing.lg,
      textAlign: 'center',
    },
    scheduleCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
    },
    scheduleCtaPressed: {
      backgroundColor: colors.goldTint,
    },
    scheduleCtaLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    sheetTitle: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
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
    sheetScroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    sheetEmpty: {
      paddingVertical: spacing.huge,
      alignItems: 'center',
      gap: spacing.xs,
    },
    sheetEmptyTitle: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    sheetEmptySub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      textAlign: 'center',
    },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      minHeight: 60,
      backgroundColor: colors.surface,
    },
    pickRowPressed: {
      backgroundColor: colors.surface2,
    },
    pickIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickBody: {
      flex: 1,
      gap: 2,
    },
    pickTitle: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    pickSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.label,
      color: colors.ink3,
    },
    pickAmount: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
  });
