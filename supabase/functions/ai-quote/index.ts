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
import { normalizeQuote, type QuoteOutput, validateQuote } from '../_shared/quote-validate.ts';
import { stateNoteFor } from '../_shared/state-notes.ts';
import { PHOTO_BUCKET, sanitizePhotoPaths } from '../_shared/photo-paths.ts';

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
  requested_start_at?: string | null;
};

type QuoteToolOutput = QuoteOutput;

type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
};
type UserContent = string | Array<ImageBlock | { type: 'text'; text: string }>;

type AnthropicResponse = {
  content: Array<{
    type: string;
    name?: string;
    input?: unknown;
  }>;
};

/**
 * Haiku first: it is ~30x cheaper than Sonnet and faster, and this is a
 * structured-extraction task it handles well. Anything that fails the
 * arithmetic / plausibility checks in quote-validate.ts is regenerated once
 * on Sonnet; if that still fails we normalize the math from the line items.
 */
const MODEL_PRIMARY = 'claude-haiku-5-5';
const MODEL_FALLBACK = 'claude-sonnet-5-5';
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

    // Only the caller's own uploads; the user-scoped client's storage
    // policies would refuse anything else anyway.
    const photoPaths = sanitizePhotoPaths(input.photos, userId);
    const images = await loadPhotoBlocks(supabase, photoPaths);

    const systemPrompt = buildSystemPrompt({
      trade: input.trade,
      state_code: input.state_code,
    });
    const userText = buildUserMessage({
      trade: input.trade,
      state_code: input.state_code,
      scope_text: input.scope_text,
      city: input.address?.city ?? null,
      customer_history: customerHistory,
      photo_count: images.length,
    });
    const userMessage: UserContent =
      images.length > 0 ? [...images, { type: 'text', text: userText }] : userText;

    // @ts-expect-error — Deno env access
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY is not configured on this project');
    }

    const startedAt = Date.now();
    const result = await generateValidatedQuote(apiKey, systemPrompt, userMessage);
    const aiMs = Date.now() - startedAt;
    const stateNotes = stateNoteFor(input.state_code);

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
        state_notes: stateNotes,
        job_type: input.trade,
        requested_start_at: validIsoOrNull(input.requested_start_at),
        photos: photoPaths,
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

async function generateValidatedQuote(
  apiKey: string,
  systemPrompt: string,
  userMessage: UserContent,
): Promise<QuoteToolOutput> {
  const primary = await callAnthropic(apiKey, MODEL_PRIMARY, systemPrompt, userMessage);
  const primaryCheck = validateQuote(primary);
  if (primaryCheck.ok) return primary;
  console.warn('[ai-quote] primary output failed validation', primaryCheck.reasons.join('; '));

  const fallback = await callAnthropic(apiKey, MODEL_FALLBACK, systemPrompt, userMessage);
  const fallbackCheck = validateQuote(fallback);
  if (fallbackCheck.ok) return fallback;
  console.warn('[ai-quote] fallback output failed validation', fallbackCheck.reasons.join('; '));

  const normalized = normalizeQuote(fallback) ?? normalizeQuote(primary);
  if (!normalized) {
    throw new HttpError(502, 'quote generation returned unusable output');
  }
  return normalized;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: UserContent,
): Promise<QuoteToolOutput> {
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      // Short structured output; no deliberation needed. With a forced tool
      // call the model skips thinking anyway, this keeps it explicit.
      output_config: { effort: 'low' },
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

/**
 * Download each photo with the caller's own client (storage policies limit
 * it to their folder) and inline it as a base64 image block. A photo that
 * fails to load is skipped rather than failing the quote.
 */
async function loadPhotoBlocks(supabase: SupabaseClient, paths: string[]): Promise<ImageBlock[]> {
  const blocks = await Promise.all(
    paths.map(async (path): Promise<ImageBlock | null> => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (error || !data) {
        console.warn('[ai-quote] photo download failed', path, error?.message);
        return null;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      return {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: toBase64(bytes) },
      };
    }),
  );
  return blocks.filter((b): b is ImageBlock => b !== null);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function validIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
