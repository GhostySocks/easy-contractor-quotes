/**
 * Entitlement check — reads from the Supabase `subscriptions` table, which is
 * the server-validated source of truth (CLAUDE.md §3).
 *
 * The RevenueCat SDK is NEVER authoritative. The webhook writes to this table;
 * the app reads from it.
 */

export type SubscriptionStatus = 'active' | 'in_grace' | 'expired' | 'cancelled';

export type SubscriptionRow = {
  user_id: string;
  status: SubscriptionStatus | string;
  product_id: string;
  platform: 'ios' | 'android' | 'stripe';
  current_period_end: string | null;
  trial_ends_at: string | null;
  updated_at: string;
};

/**
 * True when the user has active access to Pro features. The app uses this to
 * route between /app-paused and /(tabs)/home at cold start and on resume.
 *
 * "in_grace" is treated as active — RevenueCat grants a grace period on billing
 * retry. Everything else (expired, cancelled, unknown) is paused.
 */
export function isActive(
  subscription: Pick<SubscriptionRow, 'status'> | null | undefined,
): boolean {
  if (!subscription) {
    return false;
  }
  return subscription.status === 'active' || subscription.status === 'in_grace';
}
