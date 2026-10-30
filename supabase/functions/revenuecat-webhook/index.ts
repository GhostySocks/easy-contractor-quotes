// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

/**
 * RevenueCat webhook. Source of truth for the `subscriptions` table
 * (CLAUDE.md §3). The client never writes this table.
 *
 * Events we handle: INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
 * BILLING_ISSUE, NON_RENEWING_PURCHASE, EXPIRATION.
 */

type RcEvent = {
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | string;
    expiration_at_ms?: number;
  };
};

const STATUS_FROM_TYPE: Record<string, string> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  UNCANCELLATION: 'active',
  NON_RENEWING_PURCHASE: 'active',
  BILLING_ISSUE: 'in_grace',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
  SUBSCRIPTION_PAUSED: 'expired',
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  // The secret is mandatory. Without it, anyone who finds the URL could POST
  // an INITIAL_PURCHASE and grant themselves pro_access.
  // @ts-expect-error — Deno env access
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET is not set; rejecting');
    return new Response('webhook not configured', { status: 503, headers: corsHeaders });
  }
  const provided = req.headers.get('authorization')?.replace('Bearer ', '');
  if (provided !== expectedSecret) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as RcEvent;
    const event = payload.event;

    // RevenueCat also sends TEST, TRANSFER, SUBSCRIBER_ALIAS,
    // TEMPORARY_ENTITLEMENT_GRANT and future types. None of those say the
    // subscription ended, so they must not touch the status. Acknowledge
    // and ignore anything we don't explicitly map.
    const status = STATUS_FROM_TYPE[event.type];
    if (!status) {
      console.log('[revenuecat-webhook] ignoring event type', event.type);
      return new Response('ignored', { status: 200, headers: corsHeaders });
    }

    const admin = createClient(
      // @ts-expect-error — Deno env access
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-expect-error — Deno env access
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const platform =
      event.store === 'APP_STORE' ? 'ios' : event.store === 'PLAY_STORE' ? 'android' : 'stripe';

    await admin.from('subscriptions').upsert(
      {
        user_id: event.app_user_id,
        status,
        product_id: event.product_id,
        platform,
        current_period_end: event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});
