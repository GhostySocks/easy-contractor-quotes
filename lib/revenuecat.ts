import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

/**
 * RevenueCat wiring.
 *
 * Important: the client SDK is used to *trigger* purchases and read offerings.
 * Entitlement truth lives in the Supabase `subscriptions` table, which is
 * written by the RevenueCat webhook Edge Function (CLAUDE.md §3). Never rely
 * on `Purchases.getCustomerInfo().entitlements.active` alone to gate features —
 * always read from `subscriptions` via RLS.
 *
 * The native module is loaded lazily via require() so Expo Go (which does not
 * ship the RCPurchases native side) can still run the rest of the app.
 */

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

type PurchasesModule = typeof import('react-native-purchases').default;

let purchases: PurchasesModule | null = null;
let configured = false;

function getPurchases(): PurchasesModule | null {
  if (IS_EXPO_GO) return null;
  if (purchases) return purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchases = require('react-native-purchases').default as PurchasesModule;
    return purchases;
  } catch (err) {
    console.warn('[revenuecat] native module not available', err);
    return null;
  }
}

export function initRevenueCat(userId: string | null): void {
  const Purchases = getPurchases();
  if (!Purchases) return;

  if (configured) {
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
  configured = true;
}

export async function getProOffering(): Promise<PurchasesOffering | null> {
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    console.warn('[revenuecat] getOfferings failed', err);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    console.warn('[revenuecat] restorePurchases failed', err);
    return null;
  }
}

export type PurchaseOutcome =
  | { status: 'purchased'; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const Purchases = getPurchases();
  if (!Purchases) return { status: 'unavailable' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { status: 'purchased', customerInfo };
  } catch (err) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: e.message ?? 'unknown error' };
  }
}
