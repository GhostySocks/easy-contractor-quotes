import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export type JobStatus = 'in_progress' | 'scheduled' | 'completed' | 'draft';

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
  const styles = useStyles(makeStyles);
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
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { label, bg, fg } = pillStyle(status, colors);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillStyle(status: JobStatus, colors: Colors): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'in_progress':
      return { label: 'IN PROGRESS', bg: colors.goldTint, fg: colors.goldDark };
    case 'scheduled':
      return { label: 'SCHEDULED', bg: colors.surface2, fg: colors.ink2 };
    case 'completed':
      return { label: 'COMPLETED', bg: colors.surface2, fg: colors.success };
    case 'draft':
      return { label: 'DRAFT', bg: colors.goldTint, fg: colors.goldDark };
  }
}

function formatCentsShort(cents: number): string {
  const whole = Math.round(cents / 100);
  return `$${whole.toLocaleString('en-US')}`;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
      fontFamily: typography.fonts.numeric,
      fontSize: 18,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    meridiem: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.ink3,
      letterSpacing: 0.6,
    },
    middleCol: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontFamily: typography.fonts.bodyStrong,
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
      gap: spacing.xs,
    },
    pill: {
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
      fontSize: typography.sizes.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
  });
