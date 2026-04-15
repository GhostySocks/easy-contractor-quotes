import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-store';
import { formatCents } from '@/lib/pricing';
import { fetchLatestDraftForUser, type QuoteRow } from '@/lib/quotes';
import { strings } from '@/lib/strings';
import { colors, spacing, typography } from '@/lib/theme';

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const [latest, setLatest] = useState<QuoteRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const row = await fetchLatestDraftForUser(user.id);
    setLatest(row);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <View style={styles.greetingRow}>
          <Text style={styles.eyebrow}>{greeting()}</Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>

        {latest ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/quote/[id]', params: { id: latest.id } })}
          >
            <Card>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEyebrow}>Latest quote</Text>
                <ChevronRight size={16} color={colors.ink3} strokeWidth={2} />
              </View>
              <Text style={styles.cardAmount}>{formatCents(latest.total_cents)}</Text>
              <Text style={styles.cardSub} numberOfLines={2}>
                {latest.scope_of_work ?? 'No scope yet'}
              </Text>
              <Text style={styles.cardMeta}>
                {capitalize(latest.status)} · {formatAge(latest.created_at)}
              </Text>
            </Card>
          </Pressable>
        ) : (
          <Card>
            <Text style={styles.cardEyebrow}>No quotes yet</Text>
            <Text style={styles.cardSub}>{strings.locked.emptyJobs}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatAge(iso: string): string {
  const created = new Date(iso);
  const diffMs = Date.now() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return created.toLocaleDateString();
}

function capitalize(str: string): string {
  return str.length === 0 ? str : str[0].toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.huge + spacing.huge,
  },
  greetingRow: {
    gap: 2,
  },
  eyebrow: {
    fontSize: typography.sizes.h1,
    fontWeight: '800',
    color: colors.ink,
  },
  date: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardEyebrow: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
  },
  cardAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.gold,
    marginVertical: spacing.xs,
  },
  cardSub: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
    lineHeight: 22,
  },
  cardMeta: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.label,
    color: colors.ink3,
    fontWeight: '600',
  },
});
