// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

type SignInput = {
  contract_id: string;
  signature_svg: string;
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId } = await requireActiveSubscription(req);
    const input = (await req.json()) as SignInput;

    if (!input.contract_id) throw new HttpError(400, 'contract_id is required');
    if (!input.signature_svg || input.signature_svg.length < 20) {
      throw new HttpError(400, 'signature_svg is required');
    }

    // Service-role client bypasses the RLS update policy's WITH CHECK,
    // which would otherwise reject the update because signed_at is no
    // longer null after the write. Ownership is re-verified explicitly
    // below (eq user_id) so bypassing RLS does not widen access.
    // @ts-expect-error — Deno env access
    const serviceUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-expect-error — Deno env access
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceUrl || !serviceKey) {
      throw new HttpError(500, 'service-role credentials are not configured');
    }
    const admin = createClient(serviceUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: fetchErr } = await admin
      .from('contracts')
      .select('id, user_id, signed_at')
      .eq('id', input.contract_id)
      .maybeSingle();
    if (fetchErr || !existing) {
      throw new HttpError(404, `contract not found: ${fetchErr?.message ?? input.contract_id}`);
    }
    if (existing.user_id !== userId) {
      throw new HttpError(403, 'contract does not belong to this user');
    }
    if (existing.signed_at) {
      throw new HttpError(409, 'contract is already signed');
    }

    const signedIp = firstForwardedIp(req.headers.get('x-forwarded-for'));

    const { data: updated, error: updateErr } = await admin
      .from('contracts')
      .update({
        signature_svg: input.signature_svg,
        signed_at: new Date().toISOString(),
        signed_ip: signedIp,
      })
      .eq('id', input.contract_id)
      .select('*')
      .single();
    if (updateErr || !updated) {
      throw new HttpError(500, `sign failed: ${updateErr?.message ?? 'no row'}`);
    }

    return new Response(JSON.stringify(updated), {
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

function firstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
