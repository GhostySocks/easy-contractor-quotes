import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mail, MapPin, Pencil, Phone, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  TodayJobRow,
  type JobStatus as RowStatus,
  type TodayJob,
} from '@/components/ui/TodayJobRow';
import { fetchCustomer, type CustomerRow } from '@/lib/customers';
import { listJobsForCustomer, type JobWithCustomer } from '@/lib/jobs';
import { formatCents } from '@/lib/pricing';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function CustomerDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [c, j] = await Promise.all([fetchCustomer(id), listJobsForCustomer(id)]);
    setCustomer(c);
    setJobs(j);
  }, [id]);

  // Reload on focus so edits made on the edit screen show on return.
  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const openEdit = useCallback(() => {
    if (!id) return;
    router.push({ pathname: '/customer/edit/[id]', params: { id } });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackButton />
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackButton />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Customer not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const address = formatAddress(customer);
  const lastJob = customer.last_job_at ? new Date(customer.last_job_at) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <BackButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit customer"
            onPress={openEdit}
            style={({ pressed }) => [styles.editButton, pressed && styles.backPressed]}
            hitSlop={12}
          >
            <Pencil size={18} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.editLabel}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.name}>{customer.name || 'Unnamed customer'}</Text>
          {customer.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {customer.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagLabel}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <PrimaryButton
          label={`New quote for ${customer.name || 'this customer'}`}
          onPress={() =>
            router.push({ pathname: '/quote/new', params: { customerId: customer.id } })
          }
        />

        <View style={styles.statsRow}>
          <Stat label="Lifetime" value={formatCents(customer.lifetime_value_cents)} />
          <Stat label="Jobs" value={String(jobs.length)} />
          <Stat label="Last job" value={lastJob ? formatRelativeDate(lastJob) : '—'} />
        </View>

        {customer.phone || customer.email || address ? (
          <View style={styles.card}>
            {customer.phone ? (
              <ContactRow
                icon={<Phone size={18} color={colors.goldDark} strokeWidth={2} />}
                label="Phone"
                value={customer.phone}
                onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
              />
            ) : null}
            {customer.email ? (
              <ContactRow
                icon={<Mail size={18} color={colors.goldDark} strokeWidth={2} />}
                label="Email"
                value={customer.email}
                onPress={() => void Linking.openURL(`mailto:${customer.email}`)}
              />
            ) : null}
            {address ? (
              <ContactRow
                icon={<MapPin size={18} color={colors.goldDark} strokeWidth={2} />}
                label="Address"
                value={address}
                onPress={() =>
                  void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`)
                }
              />
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add phone, email or address"
            onPress={openEdit}
            style={({ pressed }) => [styles.addContact, pressed && styles.rowPressed]}
          >
            <View style={styles.contactIcon}>
              <Plus size={18} color={colors.goldDark} strokeWidth={2} />
            </View>
            <Text style={styles.addContactLabel}>Add phone, email or address</Text>
          </Pressable>
        )}

        {customer.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{customer.notes}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs with this customer</Text>
          {jobs.length === 0 ? (
            <Text style={styles.emptyState}>No jobs yet.</Text>
          ) : (
            <View style={styles.jobList}>
              {jobs.map((row) => (
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

function BackButton() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      hitSlop={12}
    >
      <ChevronLeft size={22} color={colors.ink} strokeWidth={2.5} />
      <Text style={styles.backLabel}>Back</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: (e: GestureResponderEvent) => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.contactRow, pressed && styles.rowPressed]}
    >
      <View style={styles.contactIcon}>{icon}</View>
      <View style={styles.contactBody}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

function formatAddress(c: CustomerRow): string {
  const cityState = [c.city, c.state_code].filter(Boolean).join(', ');
  const lastLine = [cityState, c.postal_code].filter(Boolean).join(' ');
  return [c.address_line1, c.address_line2, lastLine].filter(Boolean).join('\n');
}

function formatRelativeDate(d: Date): string {
  const today = new Date();
  const diffDays = Math.round(
    (startOfDay(today).getTime() - startOfDay(d).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;
  if (diffDays >= 7 && diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  if (diffDays >= 30 && diffDays < 365) return `${Math.round(diffDays / 30)}mo ago`;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toTodayJob(row: JobWithCustomer): TodayJob {
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
  };
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.huge + spacing.huge,
      gap: spacing.xl,
    },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginLeft: -spacing.xs,
      minHeight: 44,
    },
    backPressed: {
      opacity: 0.6,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      minHeight: 44,
    },
    editLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.goldDark,
    },
    addContact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 60,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.gold,
      backgroundColor: colors.surface,
    },
    addContactLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    backLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
      marginLeft: 2,
    },
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notFoundText: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink3,
    },
    titleBlock: {
      gap: spacing.sm,
    },
    name: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.display,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tag: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      backgroundColor: colors.goldTint,
      borderRadius: radii.pill,
    },
    tagLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.goldDark,
      letterSpacing: 0.4,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontFamily: typography.fonts.numeric,
      fontSize: typography.sizes.h2,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.ink3,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      paddingVertical: spacing.sm,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 60,
    },
    rowPressed: {
      opacity: 0.6,
    },
    contactIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactBody: {
      flex: 1,
      gap: 2,
    },
    contactLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.ink3,
    },
    contactValue: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    notesCard: {
      backgroundColor: colors.goldTint,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    notesLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.goldDark,
    },
    notesBody: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink,
      lineHeight: 24,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
    },
    jobList: {
      gap: spacing.md,
    },
    emptyState: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      paddingVertical: spacing.lg,
      textAlign: 'center',
    },
  });
