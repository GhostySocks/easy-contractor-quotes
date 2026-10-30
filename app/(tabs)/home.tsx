import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { MoneyPendingCard } from '@/components/ui/MoneyPendingCard';
import { TodayJobRow, type JobStatus, type TodayJob } from '@/components/ui/TodayJobRow';
import { useAuth } from '@/lib/auth-store';
import { fetchUnsignedContractCount } from '@/lib/contracts';
import { fetchUnpaidSummary, type UnpaidSummary } from '@/lib/invoices';
import { listActiveJobs, listUpcomingScheduledJobs, type JobWithCustomer } from '@/lib/jobs';
import { syncJobReminders } from '@/lib/notifications';
import {
  fetchProfile,
  firstNameFromProfile,
  initialsFromProfile,
  type ProfileRow,
} from '@/lib/profile';
import { strings } from '@/lib/strings';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const EMPTY_MONEY: UnpaidSummary = { totalCents: 0, unpaidCount: 0, overdueCount: 0 };

export default function HomeScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [money, setMoney] = useState<UnpaidSummary>(EMPTY_MONEY);
  const [unsignedContracts, setUnsignedContracts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [profileRow, jobRows, moneyRow, unsigned] = await Promise.all([
      fetchProfile(user.id),
      listActiveJobs(5),
      fetchUnpaidSummary(),
      fetchUnsignedContractCount(),
    ]);
    setProfile(profileRow);
    setJobs(jobRows);
    setMoney(moneyRow);
    setUnsignedContracts(unsigned);
  }, [user]);

  // Reload whenever Home is shown, so money and today's jobs are current after
  // working in a job or invoice, and keep job reminders in step with the
  // schedule (covers jobs scheduled anywhere, including on contract signing).
  useFocusEffect(
    useCallback(() => {
      void load();
      if (user) {
        void listUpcomingScheduledJobs().then((upcoming) =>
          syncJobReminders(upcoming.map((j) => ({ ...j, customer_name: j.customer_name }))),
        );
      }
    }, [load, user]),
  );

  const firstName = firstNameFromProfile(profile);
  const initials = initialsFromProfile(profile);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{formatDate(new Date())}</Text>
            <Text style={styles.greeting}>
              {greeting()}, {firstName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.avatarPressed}
          >
            <Avatar initials={initials} />
          </Pressable>
        </View>

        <MoneyPendingCard
          totalCents={money.totalCents}
          unpaidInvoices={money.unpaidCount}
          unsignedContracts={unsignedContracts}
          overdueCount={money.overdueCount}
          onPress={() => router.push('/payments')}
        />

        <SectionHeader
          title="Active jobs"
          rightText={jobs.length > 0 ? `${jobs.length} in flight →` : 'All jobs →'}
          onRightPress={() => router.push('/(tabs)/jobs')}
        />

        <View style={styles.jobsList}>
          {jobs.length === 0 ? (
            <Text style={styles.emptyState}>{strings.locked.emptyJobs}</Text>
          ) : (
            jobs.map((row) => (
              <TodayJobRow
                key={row.id}
                job={toTodayJob(row)}
                onPress={() => router.push({ pathname: '/job/[id]', params: { id: row.id } })}
              />
            ))
          )}
        </View>

        <SectionHeader
          title="This week"
          rightText="See calendar →"
          onRightPress={() => router.push('/(tabs)/calendar')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  rightText,
  onRightPress,
}: {
  title: string;
  rightText: string;
  onRightPress?: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="link" onPress={onRightPress} hitSlop={8}>
        <Text style={styles.sectionLink}>{rightText}</Text>
      </Pressable>
    </View>
  );
}

function toTodayJob(row: JobWithCustomer): TodayJob {
  const status: JobStatus =
    row.status === 'in_progress'
      ? 'in_progress'
      : row.status === 'completed'
        ? 'completed'
        : 'scheduled';
  return {
    id: row.id,
    title: row.title,
    customerName: row.customer_name ?? 'Customer',
    meta: row.status === 'in_progress' ? 'Active' : row.status,
    status,
    amountCents: row.total_cents ?? 0,
  };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    scroll: {
      padding: spacing.xl,
      gap: spacing.xl,
      paddingBottom: spacing.huge + spacing.huge,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerText: {
      gap: 2,
    },
    date: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    greeting: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: 26,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    avatarPressed: {
      opacity: 0.65,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    sectionTitle: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
    },
    sectionLink: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    jobsList: {
      gap: spacing.md,
    },
    emptyState: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
