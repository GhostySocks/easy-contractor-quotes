/**
 * A time limit on every Supabase request. React Native's fetch can wait
 * indefinitely on a bad connection, which left screens spinning forever and
 * could hold up the login renewal every other request waits on. A timed-out
 * request fails like any other network error, so existing handling applies.
 *
 * Kept short on purpose: after the app sits in the background, Android can
 * hand the first request a connection that has gone dead. Failing it quickly
 * lets the retry (or the next login renewal attempt) open a fresh one, instead
 * of everything queued behind it timing out too.
 */
export const REQUEST_TIMEOUT_MS = 10_000;
/** Photo uploads and edge functions (the AI) legitimately take longer. */
export const LONG_REQUEST_TIMEOUT_MS = 60_000;

type Fetch = typeof fetch;

export function timeoutFor(url: string): number {
  return url.includes('/functions/v1/') || url.includes('/storage/v1/')
    ? LONG_REQUEST_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS;
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

export function fetchWithTimeout(
  base: Fetch = (input, init) => fetch(input as RequestInfo, init),
): Fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutFor(urlOf(input)));
    // Keep honoring a caller's own cancel.
    const callerSignal = init?.signal;
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener('abort', () => controller.abort());

    return base(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
