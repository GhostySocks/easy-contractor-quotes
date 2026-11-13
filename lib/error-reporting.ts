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

/**
 * A request that puts one test event straight into the Sentry project, going
 * around the Sentry SDK. Pure, unit-tested. Lets a tester's phone show whether
 * it can reach Sentry at all (an ad blocker or private DNS can block it).
 */
export function directReport(
  dsn: string | undefined,
  variant: string | undefined,
  eventId: string,
  nowIso: string,
): { url: string; body: string } | null {
  const match = /^https:\/\/([^@/]+)@([^/]+)\/(\d+)$/.exec(dsn ?? '');
  if (!match) return null;
  const [, key, host, project] = match;
  const event = {
    event_id: eventId,
    timestamp: nowIso,
    platform: 'other',
    level: 'info',
    environment: variant || 'production',
    message: 'Test report from Settings (sent directly)',
  };
  return {
    url: `https://${host}/api/${project}/envelope/?sentry_key=${key}&sentry_version=7`,
    body: [{ event_id: eventId }, { type: 'event' }, event]
      .map((l) => JSON.stringify(l))
      .join('\n'),
  };
}

export type TestReport = {
  /** Error reporting is switched on in this build. */
  reporting: boolean;
  /** The Sentry SDK said it sent its test error. Null when reporting is off. */
  sdkSent: boolean | null;
  /** 'ok', or why the phone couldn't reach Sentry directly. */
  direct: string;
};

/** Tester builds only (Settings): send a test error both ways and say how it went. */
export async function sendTestReport(): Promise<TestReport> {
  let sdkSent: boolean | null = null;
  if (enabled) {
    Sentry.captureException(new Error('Test report from Settings'), {
      tags: { where: 'settings.test' },
    });
    sdkSent = await Sentry.flush().catch(() => false);
  }

  const eventId = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  const request = directReport(
    process.env.EXPO_PUBLIC_SENTRY_DSN,
    process.env.EXPO_PUBLIC_APP_VARIANT,
    eventId,
    new Date().toISOString(),
  );
  let direct = 'no Sentry key in this build';
  if (request) {
    try {
      const res = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: request.body,
      });
      direct = res.ok ? 'ok' : `refused (HTTP ${res.status})`;
    } catch (err) {
      direct = `blocked (${err instanceof Error ? err.message : String(err)})`;
    }
  }
  return { reporting: enabled, sdkSent, direct };
}
