import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { MoneyPendingCard } from '@/components/ui/MoneyPendingCard';
import { TodayJobRow, type TodayJob } from '@/components/ui/TodayJobRow';
import { useAuth } from '@/lib/auth-store';
import {
  fetchProfile,
  firstNameFromProfile,
  initialsFromProfile,
  type ProfileRow,
} from '@/lib/profile';
import { colors, spacing, typography } from '@/lib/theme';

// TODO(M2): replace with real aggregates from invoices + contracts tables.
const PREVIEW_MONEY = {
  totalCents: 428050,
  unpaidInvoices: 6,
  unsignedContracts: 2,
  overdueCount: 1,
};

// TODO(M2): replace with jobs where scheduled_at::date = today.
const PREVIEW_JOBS: TodayJob[] = [
  {
    id: 'p1',
    time: '9:00',
    meridiem: 'AM',
    title: 'Kitchen faucet replace',
    customerName: 'Sarah Moore',
    meta: '2mi away',
    status: 'in_progress',
    amountCents: 48000,
  },
  {
    id: 'p2',
    time: '11:30',
    meridiem: 'AM',
    title: 'Fence panel repair',
    customerName: 'Derek Hayes',
    meta: 'Repeat',
    status: 'scheduled',
    amountCents: 34000,
  },
  {
    id: 'p3',
    time: '2:00',
    meridiem: 'PM',
    title: 'Outlet install ×3',
    customerName: 'Angela Kim',
    meta: 'New',
    status: 'scheduled',
    amountCents: 22000,
  },
];

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const row = await fetchProfile(user.id);
    setProfile(row);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <Avatar initials={initials} />
        </View>

        <MoneyPendingCard
          totalCents={PREVIEW_MONEY.totalCents}
          unpaidInvoices={PREVIEW_MONEY.unpaidInvoices}
          unsignedContracts={PREVIEW_MONEY.unsignedContracts}
          overdueCount={PREVIEW_MONEY.overdueCount}
        />

        <SectionHeader
          title="Today's jobs"
          rightText={`${PREVIEW_JOBS.length} scheduled →`}
          onRightPress={() => router.push('/(tabs)/jobs')}
        />

        <View style={styles.jobsList}>
          {PREVIEW_JOBS.map((job) => (
            <TodayJobRow key={job.id} job={job} onPress={() => router.push('/(tabs)/jobs')} />
          ))}
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
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="link" onPress={onRightPress} hitSlop={8}>
        <Text style={styles.sectionLink}>{rightText}</Text>
      </Pressable>
    </View>
  );
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

const styles = StyleSheet.create({
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
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '500',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  sectionLink: {
    fontSize: typography.sizes.bodySmall,
    color: colors.goldDark,
    fontWeight: '700',
  },
  jobsList: {
    gap: spacing.md,
  },
});
