// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders } from '../_shared/cors.ts';

/**
 * Stripe webhook for Stripe Connect destination charges (customer payments
 * landing in the user's own Stripe account, CLAUDE.md §2).
 *
 * Events we handle in M1d: payment_intent.succeeded, payment_intent.failed,
 * charge.refunded, account.updated (Connect onboarding status).
 */

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  // TODO(M1d): verify Stripe signature with STRIPE_WEBHOOK_SECRET before
  // parsing the payload. Never trust the body alone.

  return new Response('ok', { status: 200, headers: corsHeaders });
});
