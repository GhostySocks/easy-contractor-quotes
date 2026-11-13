/**
 * Calling an edge function reliably from a phone. Pure, unit-tested; lib/ai.ts
 * supplies the Supabase pieces.
 *
 * Testers saw Generate fail with nothing reaching the server, then work after
 * a force quit: the login renewal was stuck from the app sitting in the
 * background. So the login is checked (and renewed if needed) first, and a
 * request that fails on the network is retried once with a renewed login.
 * An error the server sent back is shown as-is, never retried.
 */

export const OFFLINE_MESSAGE =
  "Can't reach the server. Check your signal and try again. Your details are still here.";

/** The phone couldn't reach Supabase; the request never got there. */
export class OfflineError extends Error {}

/** Renew a login that expires within this many seconds. */
const RENEW_MARGIN_SEC = 60;
const RETRY_DELAY_MS = 1500;

export function loginExpiresSoon(expiresAtSec: number | undefined, nowMs: number): boolean {
  if (expiresAtSec === undefined) return true;
  return expiresAtSec - nowMs / 1000 < RENEW_MARGIN_SEC;
}

export type InvokeOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'network' | 'server'; message: string };

/**
 * The same verdict for a database read or write. supabase-js doesn't throw
 * when a request is dropped or times out; it reports status 0. Anything else
 * with an error is the database's own answer.
 */
export function queryOutcome<T>(result: {
  data: T | null;
  error: { message: string } | null;
  status: number;
}): InvokeOutcome<T> {
  if (result.error) {
    return {
      ok: false,
      kind: result.status === 0 ? 'network' : 'server',
      message: result.error.message,
    };
  }
  return result.data === null
    ? { ok: false, kind: 'server', message: 'No data came back' }
    : { ok: true, data: result.data };
}

type Deps<T> = {
  /** Resolves once the login is good to use; throws a user-facing error otherwise. */
  ensureLogin: () => Promise<void>;
  invoke: () => Promise<InvokeOutcome<T>>;
  wait: (ms: number) => Promise<void>;
};

export async function callWithRetry<T>({ ensureLogin, invoke, wait }: Deps<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await ensureLogin();
    const outcome = await invoke();
    if (outcome.ok) return outcome.data;
    if (outcome.kind === 'server') throw new Error(outcome.message);
    if (attempt >= 2) throw new OfflineError(OFFLINE_MESSAGE);
    await wait(RETRY_DELAY_MS);
  }
}
