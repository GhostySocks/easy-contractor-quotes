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
  const { data, error } = await supabase.functions.invoke<QuoteInsertResult>('ai-quote', {
    body: input,
  });
  if (error) {
    throw new Error(`ai-quote failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('ai-quote returned no data');
  }
  return data;
}

export type ContractInput = {
  kind: 'work' | 'release';
  quote_id: string;
};

export type ContractResult = {
  id: string;
  body_markdown: string;
};

export async function generateContract(input: ContractInput): Promise<ContractResult> {
  const { data, error } = await supabase.functions.invoke<ContractResult>('ai-contract', {
    body: input,
  });
  if (error) {
    throw new Error(`ai-contract failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('ai-contract returned no data');
  }
  return data;
}
