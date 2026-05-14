// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Server-side entitlement verification. Called by every AI endpoint before
 * forwarding to Anthropic. Never trust the RevenueCat client SDK — this is the
 * only check that matters (CLAUDE.md §3).
 */
export async function requireActiveSubscription(req: Request): Promise<{
  userId: string;
  supabase: SupabaseClient;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError(401, 'missing authorization header');
  }

  const supabase = createClient(
    // @ts-expect-error — Deno env access
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-expect-error — Deno env access
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult?.user) {
    throw new HttpError(401, 'invalid session');
  }
  const userId = userResult.user.id;

  // Dev-only escape hatch — server side counterpart to the client's
  // EXPO_PUBLIC_DEV_BYPASS_PAYWALL. Honored only when explicitly set in this
  // project's edge function secrets (never via header / body, so it can't be
  // spoofed by the client). Set with:
  //   supabase secrets set DEV_BYPASS_ENTITLEMENT=true
  // and unset before deploying to production. Never prefix with EXPO_PUBLIC_.
  // @ts-expect-error — Deno env access
  const bypass = Deno.env.get('DEV_BYPASS_ENTITLEMENT');
  if (bypass === 'true' || bypass === '1') {
    return { userId, supabase };
  }

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (subError) {
    throw new HttpError(500, `subscription lookup failed: ${subError.message}`);
  }
  if (!sub || (sub.status !== 'active' && sub.status !== 'in_grace')) {
    throw new HttpError(402, 'subscription is not active');
  }

  return { userId, supabase };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
