import * as Sentry from '@sentry/react-native';

/**
 * Error reporting through Sentry (CLAUDE.md §2). Without it, a tester's
 * "it failed" can't be traced: the app already turns most failures into an
 * Alert, which Sentry never sees, so screens report those with reportError.
 *
 * Off when EXPO_PUBLIC_SENTRY_DSN is unset (local builds) and in development.
 * Only the user id is attached, never names, emails or customer details.
 */

type SentryEnv = { dsn: string | undefined; variant: string | undefined; dev: boolean };

/** Pure, unit-tested: what Sentry.init gets, or null to stay off. */
export function sentryOptions({ dsn, variant, dev }: SentryEnv) {
  if (!dsn || dev) return null;
  return {
    dsn,
    environment: variant || 'production',
    sendDefaultPii: false,
  };
}

let enabled = false;

export function initErrorReporting(): void {
  const options = sentryOptions({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    variant: process.env.EXPO_PUBLIC_APP_VARIANT,
    dev: __DEV__,
  });
  if (!options) return;
  Sentry.init(options);
  enabled = true;
}

/** Report a failure the app handled itself (shown in an Alert, etc). */
export function reportError(err: unknown, where: string): void {
  if (!enabled) return;
  Sentry.captureException(err, { tags: { where } });
}

export function setErrorReportingUser(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
