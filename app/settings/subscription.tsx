import { router } from 'expo-router';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { DEV_BYPASS_PAYWALL } from '@/lib/dev-flags';
import { type SubscriptionRow } from '@/lib/entitlement';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function SubscriptionSettings() {
  const subscription = useAuth((s) => s.subscription);

  const state = describeState(subscription);

  function handleManage() {
    // Apple and Google each have their own subscription management screens.
    // We just deep-link to them; RevenueCat doesn't proxy this.
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    void Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackButton />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>Pro is the only tier — $9.99/month after the trial.</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Sparkles size={20} color={colors.gold} strokeWidth={2} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroLabel}>{state.headline}</Text>
            <Text style={styles.heroSub}>{state.sub}</Text>
          </View>
        </View>

        {subscription ? (
          <View style={styles.card}>
            <DetailRow label="Plan" value={planLabel(subscription)} />
            <DetailRow label="Status" value={titleCase(subscription.status)} />
            {subscription.trial_ends_at ? (
              <DetailRow label="Trial ends" value={formatLongDate(subscription.trial_ends_at)} />
            ) : null}
            {subscription.current_period_end ? (
              <DetailRow label="Renews" value={formatLongDate(subscription.current_period_end)} />
            ) : null}
            <DetailRow label="Platform" value={titleCase(subscription.platform)} />
          </View>
        ) : null}

        {DEV_BYPASS_PAYWALL ? (
          <View style={styles.devCallout}>
            <Text style={styles.devLabel}>DEV BYPASS ACTIVE</Text>
            <Text style={styles.devBody}>
              EXPO_PUBLIC_DEV_BYPASS_PAYWALL is set in .env.local, so isActive() returns true
              regardless of the subscriptions table. Remove the flag and restart Metro to test the
              real paywall.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {subscription ? (
            <PrimaryButton label="Manage subscription" onPress={handleManage} />
          ) : (
            <PrimaryButton label="See plans" onPress={() => router.push('/paywall')} />
          )}
          <GhostButton label="Back to settings" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton() {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function describeState(subscription: SubscriptionRow | null): { headline: string; sub: string } {
  if (DEV_BYPASS_PAYWALL) {
    return {
      headline: 'Pro · Dev access',
      sub: 'You have full access locally because the dev bypass flag is on.',
    };
  }
  if (!subscription) {
    return {
      headline: 'No active plan',
      sub: 'Start a 7-day free trial — no commitment, cancel anytime.',
    };
  }
  switch (subscription.status) {
    case 'active':
      return { headline: 'Pro · Active', sub: 'Everything is unlocked. Thank you.' };
    case 'in_grace':
      return {
        headline: 'Pro · Grace period',
        sub: "We're retrying your last payment. Your access is still unlocked.",
      };
    case 'expired':
      return {
        headline: 'Pro · Expired',
        sub: 'Restart to keep using Pro features.',
      };
    case 'cancelled':
      return {
        headline: 'Pro · Cancelled',
        sub: 'You can re-subscribe anytime.',
      };
    default:
      return { headline: 'Pro', sub: titleCase(subscription.status) };
  }
}

function planLabel(s: SubscriptionRow): string {
  // Product IDs come straight from RevenueCat / the store webhook.
  if (s.product_id.includes('annual')) return 'Pro · Annual';
  if (s.product_id.includes('monthly')) return 'Pro · Monthly';
  return s.product_id;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
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
  backLabel: {
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '600',
    marginLeft: 2,
  },
  titleBlock: {
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  heroBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    gap: 2,
  },
  heroLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    color: colors.gold,
  },
  heroSub: {
    fontSize: typography.sizes.bodySmall,
    color: colors.goldTint,
    opacity: 0.85,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink3,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  devCallout: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warn,
    backgroundColor: 'rgba(200, 138, 0, 0.08)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.warn,
  },
  devBody: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
