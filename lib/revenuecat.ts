import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesOffering } from 'react-native-purchases';

/**
 * RevenueCat wiring.
 *
 * Important: the client SDK is used to *trigger* purchases and read offerings.
 * Entitlement truth lives in the Supabase `subscriptions` table, which is
 * written by the RevenueCat webhook Edge Function (CLAUDE.md §3). Never rely
 * on `Purchases.getCustomerInfo().entitlements.active` alone to gate features —
 * always read from `subscriptions` via RLS.
 */

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let initialized = false;

export function initRevenueCat(userId: string | null): void {
  if (initialized) {
    if (userId) {
      void Purchases.logIn(userId);
    }
    return;
  }

  const apiKey = Platform.select({ ios: iosKey, android: androidKey });
  if (!apiKey) {
    console.warn('[revenuecat] no API key for this platform; skipping SDK init');
    return;
  }

  Purchases.configure({ apiKey, appUserID: userId ?? undefined });
  initialized = true;
}

export async function getProOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    console.warn('[revenuecat] getOfferings failed', err);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    console.warn('[revenuecat] restorePurchases failed', err);
    return null;
  }
}

export { Purchases };
