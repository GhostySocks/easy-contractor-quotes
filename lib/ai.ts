import { FunctionsHttpError, isAuthApiError } from '@supabase/supabase-js';

import {
  callWithRetry,
  type InvokeOutcome,
  loginExpiresSoon,
  OFFLINE_MESSAGE,
  OfflineError,
} from './function-call';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';

export { OfflineError } from './function-call';

/**
 * Client for the AI Edge Functions.
 * The client NEVER touches the Anthropic API key — all calls go through
 * /supabase/functions/ai-quote and /ai-contract (CLAUDE.md §3).
 *
 * Each function first re-verifies that subscriptions.status = 'active' for
 * the caller's user_id before forwarding to Anthropic.
 */

export type QuoteInput = {
  trade: string;
  state_code: string;
  scope_text: string;
  customer_id: string | null;
  address: {
    line1?: string;
    city?: string;
    state_code?: string;
    postal_code?: string;
  } | null;
  /** Storage paths in the job-photos bucket (lib/photos.ts). */
  photos: string[];
  /** ISO timestamp the customer wants the work to start, or null. */
  requested_start_at?: string | null;
};

export type LineItem = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

export type QuoteInsertResult = {
  id: string;
  ai_generation_ms: number;
};

/** The screen stopped waiting; the edge function may still finish and save the quote. */
export class AiTimeoutError extends Error {}

export async function generateQuote(input: QuoteInput): Promise<QuoteInsertResult> {
  return await invokeWithTimeout<QuoteInsertResult>('ai-quote', input);
}

/**
 * After a timeout, keep looking for the quote the edge function saves when it
 * finishes, then notify. Runs outside any screen so the contractor can move
 * on. Gives up quietly after `forMs`.
 */
export function finishQuoteInBackground(
  startedAt: string,
  onReady: (quoteId: string) => void,
  forMs = 120_000,
  everyMs = 4_000,
): void {
  const deadline = Date.now() + forMs;
  const tick = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('id')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      onReady(data.id as string);
      return;
    }
    if (Date.now() < deadline) setTimeout(() => void tick(), everyMs);
  };
  setTimeout(() => void tick(), everyMs);
}

export type ContractInput = {
  kind: 'work' | 'release';
  quote_id: string;
  /** Create the next version of this signed contract instead of a new one. */
  amend_contract_id?: string;
};

export type ContractResult = {
  id: string;
  body_markdown: string;
  signing_token: string;
};

export async function generateContract(input: ContractInput): Promise<ContractResult> {
  return await invokeWithTimeout<ContractResult>('ai-contract', input);
}

/** How long the login check may take before we call it a weak signal. */
const LOGIN_CHECK_MS = 15_000;

/**
 * Make sure the login is usable before calling the server: getSession renews
 * an expired one itself, and one about to expire is renewed now. Both are
 * time-limited, because a renewal stuck from the app sitting in the
 * background is what made Generate fail until a force quit.
 */
async function ensureLogin(): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      LOGIN_CHECK_MS,
      'Checking your login',
    );
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error(SIGNED_OUT_MESSAGE);
    if (loginExpiresSoon(session.expires_at, Date.now())) {
      const renewed = await withTimeout(
        supabase.auth.refreshSession(),
        LOGIN_CHECK_MS,
        'Renewing your login',
      );
      if (renewed.error) throw renewed.error;
    }
  } catch (err) {
    if (isAuthApiError(err)) throw new Error(SIGNED_OUT_MESSAGE);
    if (err instanceof Error && err.message === SIGNED_OUT_MESSAGE) throw err;
    // Timed out or couldn't reach Supabase.
    throw new OfflineError(OFFLINE_MESSAGE);
  }
}

const SIGNED_OUT_MESSAGE = 'Your login expired. Sign out from Settings and sign back in.';

async function invokeOnce<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome<T>> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) {
    return data
      ? { ok: true, data }
      : { ok: false, kind: 'server', message: `${name} returned no data` };
  }
  if (error instanceof FunctionsHttpError) {
    // The function's own message ("subscription is not active", ...) is in the body.
    const text = await (error.context as Response | undefined)?.text().catch(() => '');
    return { ok: false, kind: 'server', message: text || error.message };
  }
  // FunctionsFetchError / FunctionsRelayError: it never reached the function.
  return { ok: false, kind: 'network', message: error.message };
}

/**
 * Call an edge function with a login check, one retry on a network failure,
 * and a hard limit on how long the screen waits for the answer. Errors are
 * human-readable so the caller's `catch` can show them in an Alert.
 */
async function invokeWithTimeout<T>(
  name: string,
  body: Record<string, unknown>,
  ms = 30_000,
): Promise<T> {
  // The clock starts when a request is actually sent: AiTimeoutError tells
  // the screen the quote may still finish on the server, which is only true
  // once the server has it. A slow login check fails as OfflineError instead.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startClock = () => {};
  const timeout = new Promise<never>((_, reject) => {
    startClock = () => {
      timer ??= setTimeout(
        () =>
          reject(
            new AiTimeoutError(
              `${name} did not respond within ${Math.round(ms / 1000)}s — check your Supabase edge function is deployed and reachable.`,
            ),
          ),
        ms,
      );
    };
  });
  try {
    return await Promise.race([
      callWithRetry<T>({
        ensureLogin,
        invoke: () => {
          startClock();
          return invokeOnce<T>(name, body);
        },
        wait: (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
