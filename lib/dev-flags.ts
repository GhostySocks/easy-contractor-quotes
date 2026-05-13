/**
 * Dev-only feature flags. Every flag here is double-gated on `__DEV__` so a
 * production build cannot honor them even if the env var leaks into the
 * bundle. Never use these to gate production behavior — they are strictly for
 * the local Expo workflow.
 */

function readBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Skip RevenueCat + the paywall entirely. When true:
 *   - `isActive()` returns true regardless of the `subscriptions` table
 *   - sign-up commits the onboarding profile and routes straight to home
 *   - the paywall shows a "Continue without subscribing" dev button
 *
 * Set `EXPO_PUBLIC_DEV_BYPASS_PAYWALL=true` in `.env.local` to enable.
 */
export const DEV_BYPASS_PAYWALL = __DEV__ && readBool(process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL);
