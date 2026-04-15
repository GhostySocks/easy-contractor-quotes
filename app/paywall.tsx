import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { type PurchasesOffering } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { useOnboardingDraft } from '@/lib/onboarding-store';
import { getProOffering, Purchases, restorePurchases } from '@/lib/revenuecat';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function Paywall() {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const user = useAuth((s) => s.user);
  const draft = useOnboardingDraft();

  useEffect(() => {
    void getProOffering().then(setOffering);
  }, []);

  async function handlePurchase() {
    if (!offering) {
      Alert.alert('Subscriptions unavailable', 'RevenueCat is not configured yet.');
      return;
    }
    const pkg =
      offering.availablePackages.find((p) => p.product.identifier === 'ecq_pro_monthly_999') ??
      offering.availablePackages[0];
    if (!pkg) {
      Alert.alert('No package available');
      return;
    }

    setPurchasing(true);
    try {
      await Purchases.purchasePackage(pkg);
      await commitOnboardingProfile(user?.id, draft);
      router.replace('/(tabs)/home');
    } catch (err) {
      const e = err as { userCancelled?: boolean; message?: string };
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message ?? 'Unknown error');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    const info = await restorePurchases();
    if (info?.entitlements.active['pro_access']) {
      router.replace('/(tabs)/home');
      return;
    }
    Alert.alert('No active subscription found');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.hero}>{strings.paywall.hero}</Text>

        <View style={styles.features}>
          {strings.paywall.features.map((feature) => (
            <View key={feature} style={styles.feature}>
              <Check size={18} color={colors.goldDark} strokeWidth={3} />
              <Text style={styles.featureLabel}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.price}>$9.99/month</Text>
          <Text style={styles.priceSub}>{strings.paywall.priceLine}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={strings.paywall.cta} loading={purchasing} onPress={handlePurchase} />
        <Text style={styles.trust}>{strings.paywall.trustLine}</Text>
        <Pressable onPress={handleRestore} style={styles.restore} accessibilityRole="link">
          <Text style={styles.restoreLabel}>{strings.paywall.restore}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

async function commitOnboardingProfile(
  userId: string | undefined,
  draft: ReturnType<typeof useOnboardingDraft.getState>,
): Promise<void> {
  if (!userId) return;
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    business_name: draft.business_name || 'My business',
    logo_url: draft.logo_url,
    state_code: draft.state_code || 'TX',
    trade: draft.trade,
    onboarding_completed_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[profiles] upsert failed', error.message);
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.xl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.ink,
  },
  features: {
    gap: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureLabel: {
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '500',
  },
  priceCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.gold,
  },
  priceSub: {
    fontSize: typography.sizes.bodySmall,
    color: colors.goldTint,
    opacity: 0.85,
  },
  footer: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  trust: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
    textAlign: 'center',
  },
  restore: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  restoreLabel: {
    color: colors.ink2,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },
});
