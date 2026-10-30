import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { DEV_BYPASS_PAYWALL } from '@/lib/dev-flags';
import { commitOnboardingProfile } from '@/lib/onboarding-commit';
import { getProOffering, purchasePackage, restorePurchases } from '@/lib/revenuecat';
import { strings } from '@/lib/strings';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function Paywall() {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    void getProOffering().then(setOffering);
  }, []);

  async function handleDevSkip() {
    await commitOnboardingProfile(user?.id);
    router.replace('/(tabs)/home');
  }

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
    const outcome = await purchasePackage(pkg);
    setPurchasing(false);

    if (outcome.status === 'purchased') {
      await commitOnboardingProfile(user?.id);
      router.replace('/(tabs)/home');
    } else if (outcome.status === 'unavailable') {
      Alert.alert(
        'Purchases not available',
        'Run the app in a development build to complete a purchase.',
      );
    } else if (outcome.status === 'error') {
      Alert.alert('Purchase failed', outcome.message);
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
        <Text style={styles.hero}>{strings.locked.paywallHeadline}</Text>

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
          <Text style={styles.priceSub}>{strings.locked.paywallPriceLine}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={strings.paywall.cta} loading={purchasing} onPress={handlePurchase} />
        <Text style={styles.trust}>{strings.locked.paywallTrustLine}</Text>
        <Pressable onPress={handleRestore} style={styles.restore} accessibilityRole="link">
          <Text style={styles.restoreLabel}>{strings.paywall.restore}</Text>
        </Pressable>

        {DEV_BYPASS_PAYWALL ? (
          <Pressable onPress={handleDevSkip} style={styles.devSkip} accessibilityRole="button">
            <Text style={styles.devSkipLabel}>DEV — continue without subscribing</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
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
  devSkip: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.sm,
    borderStyle: 'dashed',
  },
  devSkipLabel: {
    color: colors.ink3,
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
