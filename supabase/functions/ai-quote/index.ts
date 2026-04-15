// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';
import {
  buildSystemPrompt,
  buildUserMessage,
  QUOTE_TOOL_INPUT_SCHEMA,
  QUOTE_TOOL_NAME,
  type CustomerHistory,
} from '../_shared/prompts.ts';

type QuoteInput = {
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

type QuoteToolOutput = {
  scope_of_work: string;
  line_items: Array<{
    label: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
  }>;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  total_low_cents: number;
  total_high_cents: number;
  state_notes: string | null;
};

type AnthropicResponse = {
  content: Array<{
    type: string;
    name?: string;
    input?: unknown;
  }>;
};

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await requireActiveSubscription(req);
    const input = (await req.json()) as QuoteInput;

    if (!input.scope_text || input.scope_text.trim().length < 5) {
      throw new HttpError(400, 'scope_text must be at least a few characters');
    }

    const customerHistory = await loadCustomerHistory(supabase, input.customer_id);

    const systemPrompt = buildSystemPrompt({
      trade: input.trade,
      state_code: input.state_code,
    });
    const userMessage = buildUserMessage({
      trade: input.trade,
      state_code: input.state_code,
      scope_text: input.scope_text,
      city: input.address?.city ?? null,
      customer_history: customerHistory,
    });

    // @ts-expect-error — Deno env access
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY is not configured on this project');
    }

    const startedAt = Date.now();
    const result = await callAnthropic(apiKey, systemPrompt, userMessage);
    const aiMs = Date.now() - startedAt;

    const { data: inserted, error: insertError } = await supabase
      .from('quotes')
      .insert({
        user_id: userId,
        customer_id: input.customer_id,
        ai_generation_ms: aiMs,
        scope_of_work: result.scope_of_work,
        line_items: result.line_items,
        subtotal_cents: result.subtotal_cents,
        tax_cents: result.tax_cents,
        total_cents: result.total_cents,
        total_low_cents: result.total_low_cents,
        total_high_cents: result.total_high_cents,
        state_notes: result.state_notes,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw new HttpError(500, `insert quote failed: ${insertError?.message ?? 'no row'}`);
    }

    return new Response(JSON.stringify({ id: inserted.id, ai_generation_ms: aiMs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status, headers: corsHeaders });
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

async function loadCustomerHistory(
  supabase: SupabaseClient,
  customerId: string | null,
): Promise<CustomerHistory | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from('customers')
    .select('name, lifetime_value_cents, last_job_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!data) return null;
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);
  return {
    customer_name: data.name,
    prior_job_count: count ?? 0,
    last_job_at: data.last_job_at,
    lifetime_value_cents: data.lifetime_value_cents,
  };
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<QuoteToolOutput> {
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      tools: [
        {
          name: QUOTE_TOOL_NAME,
          description: 'Return the structured contractor quote.',
          input_schema: QUOTE_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: QUOTE_TOOL_NAME },
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new HttpError(502, `Anthropic error ${resp.status}: ${body.slice(0, 400)}`);
  }

  const result = (await resp.json()) as AnthropicResponse;
  const toolUse = result.content.find((c) => c.type === 'tool_use' && c.name === QUOTE_TOOL_NAME);
  if (!toolUse || !toolUse.input) {
    throw new HttpError(502, 'Anthropic response did not include the expected tool use');
  }
  return toolUse.input as QuoteToolOutput;
}
