/**
 * Dev / tester feature flags. Every flag here is gated so a production build
 * cannot honor it even if the env var leaks into the bundle. Never use these to
 * gate production behavior — they are strictly for the local Expo workflow and
 * for internal tester builds shared outside the stores.
 */

function readBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Build variant, set per EAS build profile in `eas.json` via
 * `EXPO_PUBLIC_APP_VARIANT`. Production builds leave it unset.
 *
 *   - 'internal'   — tester APK distributed by link (EAS internal distribution)
 *   - 'production' — store builds (default when unset)
 */
export const APP_VARIANT: 'internal' | 'production' =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'internal' ? 'internal' : 'production';

export const IS_INTERNAL_BUILD = APP_VARIANT === 'internal';

/**
 * Skip RevenueCat + the paywall entirely. When true:
 *   - `isActive()` returns true regardless of the `subscriptions` table
 *   - sign-up commits the onboarding profile and routes straight to home
 *   - the paywall shows a "Continue without subscribing" dev button
 *
 * Honored only in debug builds (`__DEV__`) or in the `internal` build variant,
 * and only when `EXPO_PUBLIC_DEV_BYPASS_PAYWALL=true` is also set. Store builds
 * ignore both: the variant is unset and `__DEV__` is false.
 */
export const DEV_BYPASS_PAYWALL =
  (__DEV__ || IS_INTERNAL_BUILD) && readBool(process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL);
