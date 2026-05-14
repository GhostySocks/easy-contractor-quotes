import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TodayJobRow,
  type JobStatus as RowStatus,
  type TodayJob,
} from '@/components/ui/TodayJobRow';
import { listJobsByDateRange, type JobWithCustomer } from '@/lib/jobs';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function CalendarScreen() {
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => isoDay(new Date()));
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);

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

  const markedDates = useMemo(() => buildMarkedDates(jobs, selectedDay), [jobs, selectedDay]);
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
            theme={calendarTheme}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildMarkedDates(
  jobs: JobWithCustomer[],
  selectedDay: string,
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
    selectedColor: colors.ink,
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

const calendarTheme = {
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  textSectionTitleColor: colors.ink3,
  selectedDayBackgroundColor: colors.ink,
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
};

const styles = StyleSheet.create({
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
    fontSize: typography.sizes.display,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '500',
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
    fontSize: typography.sizes.h2,
    fontWeight: '800',
    color: colors.ink,
    flexShrink: 1,
  },
  dayCount: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '600',
  },
  jobsList: {
    gap: spacing.md,
  },
  emptyState: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});
