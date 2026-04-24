// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';

/**
 * Public (unauthenticated) signature submission. Twin of the authenticated
 * /sign-contract function — auth here is by signing token, not JWT. Same
 * service-role pattern: bypass RLS for the post-sign write, re-verify the
 * token against the row before writing.
 */

type SubmitInput = {
  token: string;
  signature_svg: string;
};

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const input = (await req.json()) as SubmitInput;

    if (!input.token || typeof input.token !== 'string') {
      return new Response('token is required', { status: 400, headers: corsHeaders });
    }
    if (!input.signature_svg || input.signature_svg.length < 20) {
      return new Response('signature_svg is required', { status: 400, headers: corsHeaders });
    }

    // @ts-expect-error — Deno env access
    const serviceUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-expect-error — Deno env access
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceUrl || !serviceKey) {
      return new Response('service credentials are not configured', {
        status: 500,
        headers: corsHeaders,
      });
    }
    const admin = createClient(serviceUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: fetchErr } = await admin
      .from('contracts')
      .select('id, signed_at, signing_token_expires_at')
      .eq('signing_token', input.token)
      .maybeSingle();
    if (fetchErr || !existing) {
      return new Response('invalid token', { status: 404, headers: corsHeaders });
    }
    if (existing.signed_at) {
      return new Response('contract is already signed', { status: 409, headers: corsHeaders });
    }
    if (
      existing.signing_token_expires_at &&
      new Date(existing.signing_token_expires_at).getTime() < Date.now()
    ) {
      return new Response('signing link has expired', { status: 410, headers: corsHeaders });
    }

    const signedIp = firstForwardedIp(req.headers.get('x-forwarded-for'));

    const { error: updateErr } = await admin
      .from('contracts')
      .update({
        signature_svg: input.signature_svg,
        signed_at: new Date().toISOString(),
        signed_ip: signedIp,
      })
      .eq('id', existing.id);
    if (updateErr) {
      return new Response(`sign failed: ${updateErr.message}`, {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ signed: true }), { headers: JSON_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

function firstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
