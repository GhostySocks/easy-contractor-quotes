import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SubscriptionRow } from './entitlement';

/**
 * The last subscription status the server gave this phone, so a paying
 * customer opening the app on a weak signal isn't told they're paused because
 * the lookup failed. UI only: edge functions still check the `subscriptions`
 * table on every quote and contract (CLAUDE.md §6).
 */
const key = (userId: string) => `ecq.subscription.${userId}`;
const DAY_MS = 86_400_000;
/** How long past its period to trust a saved status with no word from the server. */
const STALE_AFTER_DAYS = 7;

/** A saved row counts only if it was active and its period hasn't long ended. Pure. */
export function usableCachedSubscription(
  row: SubscriptionRow | null,
  now = Date.now(),
): SubscriptionRow | null {
  if (!row || (row.status !== 'active' && row.status !== 'in_grace')) return null;
  if (!row.current_period_end) return row;
  const end = Date.parse(row.current_period_end);
  return now - end > STALE_AFTER_DAYS * DAY_MS ? null : row;
}

export async function readCachedSubscription(userId: string): Promise<SubscriptionRow | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return usableCachedSubscription(raw ? (JSON.parse(raw) as SubscriptionRow) : null);
  } catch {
    return null;
  }
}

export async function saveCachedSubscription(
  userId: string,
  row: SubscriptionRow | null,
): Promise<void> {
  try {
    if (row) await AsyncStorage.setItem(key(userId), JSON.stringify(row));
    else await AsyncStorage.removeItem(key(userId));
  } catch (err) {
    console.warn('[subscriptions] cache write failed', err);
  }
}
