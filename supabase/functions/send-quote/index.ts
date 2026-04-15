// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

type SendQuoteInput = {
  quote_id: string;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  contract_url: string;
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId } = await requireActiveSubscription(req);
    const input = (await req.json()) as SendQuoteInput;
    await deliverQuote(userId, input);
    return new Response(JSON.stringify({ sent: true }), {
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

async function deliverQuote(_userId: string, _input: SendQuoteInput): Promise<void> {
  // TODO(M1d): wire Twilio SMS + Resend email using the short-link to the
  // signable contract URL. Both sends happen in parallel; partial failure
  // surfaces as a toast with the channel that failed.
}
