// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

type QuoteInput = {
  trade: string;
  state_code: string;
  scope_text: string;
  customer_id: string | null;
  address: Record<string, string | undefined> | null;
  photos: string[];
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId } = await requireActiveSubscription(req);
    const input = (await req.json()) as QuoteInput;
    const result = await generateQuote(userId, input);
    return new Response(JSON.stringify(result), {
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

async function generateQuote(_userId: string, _input: QuoteInput) {
  // TODO(M1b): wire Anthropic Claude Sonnet 4.6 call with the prompt that
  // takes (trade, state, scope, history stats) and returns line items +
  // price range + state notes. See CLAUDE.md §2 + PRD §4.2.
  return {
    scope_of_work:
      'Assemble 3 flat-pack dressers and mount a 65" TV. Level, anchor, and cable-manage.',
    line_items: [
      { label: 'Labor 3h', qty: 3, unit_price_cents: 9500, total_cents: 28500 },
      { label: 'Materials', qty: 1, unit_price_cents: 2800, total_cents: 2800 },
      { label: 'Travel & disposal', qty: 1, unit_price_cents: 3500, total_cents: 3500 },
    ],
    subtotal_cents: 34800,
    tax_cents: 0,
    total_cents: 34800,
    total_low_cents: 27840,
    total_high_cents: 43500,
    state_notes: null,
  };
}
