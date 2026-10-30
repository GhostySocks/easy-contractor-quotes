import { supabase } from './supabase';

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
  photos: string[];
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

export async function generateQuote(input: QuoteInput): Promise<QuoteInsertResult> {
  return await invokeWithTimeout<QuoteInsertResult>('ai-quote', input);
}

export type ContractInput = {
  kind: 'work' | 'release';
  quote_id: string;
};

export type ContractResult = {
  id: string;
  body_markdown: string;
  signing_token: string;
};

export async function generateContract(input: ContractInput): Promise<ContractResult> {
  return await invokeWithTimeout<ContractResult>('ai-contract', input);
}

/**
 * Wrap supabase.functions.invoke with a hard timeout so the UI never spins
 * forever on a slow or unreachable Edge Function. Surfaces a human-readable
 * error so the caller's `catch` can show it in an Alert.
 */
async function invokeWithTimeout<T>(
  name: string,
  body: Record<string, unknown>,
  ms = 30_000,
): Promise<T> {
  const start = Date.now();
  const result = await Promise.race<
    { kind: 'ok'; data: T | null; err: { message: string } | null } | { kind: 'timeout' }
  >([
    supabase.functions.invoke<T>(name, { body }).then((r) => ({
      kind: 'ok' as const,
      data: r.data,
      err: r.error ? { message: r.error.message } : null,
    })),
    new Promise((resolve) => setTimeout(() => resolve({ kind: 'timeout' as const }), ms)),
  ]);

  if (result.kind === 'timeout') {
    throw new Error(
      `${name} did not respond within ${Math.round(ms / 1000)}s — check your Supabase edge function is deployed and reachable.`,
    );
  }
  if (result.err) {
    throw new Error(`${name} failed: ${result.err.message}`);
  }
  if (!result.data) {
    throw new Error(`${name} returned no data (after ${Date.now() - start}ms)`);
  }
  return result.data;
}
