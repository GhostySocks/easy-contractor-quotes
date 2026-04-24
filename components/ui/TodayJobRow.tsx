import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { formatCents } from '@/lib/pricing';
import { colors, radii, spacing, typography } from '@/lib/theme';

export type JobStatus = 'in_progress' | 'scheduled' | 'completed';

export type TodayJob = {
  id: string;
  time?: string;
  meridiem?: 'AM' | 'PM';
  title: string;
  customerName: string;
  meta: string;
  status: JobStatus;
  amountCents: number;
};

type Props = {
  job: TodayJob;
  onPress?: () => void;
  style?: ViewStyle;
};

export function TodayJobRow({ job, onPress, style }: Props) {
  const hasTime = !!job.time;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasTime
          ? `${job.title} for ${job.customerName} at ${job.time} ${job.meridiem}`
          : `${job.title} for ${job.customerName}`
      }
      onPress={onPress}
      style={({ pressed }) => [styles.row, style, pressed && styles.rowPressed]}
    >
      {hasTime ? (
        <View style={styles.timeCol}>
          <Text style={styles.time}>{job.time}</Text>
          <Text style={styles.meridiem}>{job.meridiem}</Text>
        </View>
      ) : null}

      <View style={styles.middleCol}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {job.customerName} · {job.meta}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <StatusPill status={job.status} />
        <Text style={styles.amount}>{formatCentsShort(job.amountCents)}</Text>
      </View>
    </Pressable>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const { label, bg, fg } = pillStyle(status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillStyle(status: JobStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'in_progress':
      return { label: 'IN PROGRESS', bg: colors.goldTint, fg: colors.goldDark };
    case 'scheduled':
      return { label: 'SCHEDULED', bg: colors.surface2, fg: colors.ink2 };
    case 'completed':
      return { label: 'COMPLETED', bg: colors.surface2, fg: colors.success };
  }
}

function formatCentsShort(cents: number): string {
  const whole = Math.round(cents / 100);
  return `$${whole.toLocaleString('en-US')}`;
}

const styles = StyleSheet.create({
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
  timeCol: {
    width: 52,
    alignItems: 'flex-start',
  },
  time: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  meridiem: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    color: colors.ink3,
    letterSpacing: 0.6,
  },
  middleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
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
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  amount: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
