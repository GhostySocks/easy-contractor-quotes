import { supabase } from './supabase';

/**
 * Client for the AI Edge Functions.
 * The client NEVER touches the Anthropic API key — all calls go through
 * /supabase/functions/ai-quote and /ai-contract (CLAUDE.md §3).
 *
 * Each function first re-verifies that subscriptions.status = 'active' for the
 * caller's user_id before forwarding to Anthropic.
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

export type QuoteResult = {
  scope_of_work: string;
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  total_low_cents: number;
  total_high_cents: number;
  state_notes: string | null;
};

export async function generateQuote(input: QuoteInput): Promise<QuoteResult> {
  const { data, error } = await supabase.functions.invoke<QuoteResult>('ai-quote', {
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
  job_id: string;
  state_code: string;
};

export type ContractResult = {
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
