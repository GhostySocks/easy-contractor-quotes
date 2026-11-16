// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { onContractSigned } from '../_shared/post-sign.ts';
import { sendSignedEmails } from '../_shared/signed-notice.ts';
import {
  cleanSignerName,
  cleanUserAgent,
  isAcceptableSignatureSvg,
  sha256Hex,
  typedSignatureSvg,
} from '../_shared/signing-record.ts';

/**
 * Public (unauthenticated) signature submission. Twin of the authenticated
 * /sign-contract function — auth here is by signing token, not JWT. Same
 * service-role pattern: bypass RLS for the post-sign write, re-verify the
 * token against the row before writing.
 *
 * The signer must type their full name and agree to sign electronically.
 * Along with the signature, time and IP, this saves that name and consent,
 * their device, and a fingerprint of the exact text they signed, then emails
 * the customer a signed copy and tells the contractor.
 */

type SubmitInput = {
  token: string;
  signer_name?: unknown;
  consent?: unknown;
  /** 'drawn' sends signature_svg; 'typed' has the server draw the name. */
  method?: unknown;
  signature_svg?: unknown;
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
    const signerName = cleanSignerName(input.signer_name);
    if (!signerName) {
      return new Response('Type your full name to sign.', { status: 400, headers: corsHeaders });
    }
    if (input.consent !== true) {
      return new Response('Tick the box to agree to sign electronically.', {
        status: 400,
        headers: corsHeaders,
      });
    }
    const method = input.method === 'typed' ? 'typed' : 'drawn';
    if (method === 'drawn' && !isAcceptableSignatureSvg(input.signature_svg)) {
      return new Response('Draw your signature, or choose to use your typed name.', {
        status: 400,
        headers: corsHeaders,
      });
    }
    const signatureSvg =
      method === 'typed' ? typedSignatureSvg(signerName) : (input.signature_svg as string);

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
      .select('id, signed_at, signing_token_expires_at, body_markdown')
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

    // One update, guarded on still being unsigned: two taps can't both sign,
    // and the fingerprint is of the text this request read and showed.
    const signedAt = new Date().toISOString();
    const { data: signedRows, error: updateErr } = await admin
      .from('contracts')
      .update({
        signature_svg: signatureSvg,
        signed_at: signedAt,
        signed_ip: signedIp,
        signer_name: signerName,
        signed_consent_at: signedAt,
        signed_user_agent: cleanUserAgent(req.headers.get('user-agent')),
        signature_method: method,
        body_sha256: await sha256Hex(existing.body_markdown),
      })
      .eq('id', existing.id)
      .is('signed_at', null)
      .select('id');
    if (updateErr) {
      return new Response(`sign failed: ${updateErr.message}`, {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!signedRows || signedRows.length === 0) {
      return new Response('This agreement was just signed or changed. Reload the page.', {
        status: 409,
        headers: corsHeaders,
      });
    }

    // Create the downstream job + flip the quote to accepted. Failures are
    // logged but don't block the 200 response.
    await onContractSigned(admin, existing.id);

    // The same link now shows the signed copy.
    const url = new URL(req.url);
    const signBase: string =
      // @ts-expect-error — Deno env access
      Deno.env.get('CUSTOMER_SIGN_BASE_URL') ??
      `${url.origin}${url.pathname.replace('/customer-sign-submit', '/customer-sign')}`;
    const viewUrl = `${signBase}?token=${encodeURIComponent(input.token)}`;
    const emailed = await sendSignedEmails(admin, existing.id, viewUrl);

    return new Response(
      JSON.stringify({ signed: true, customer_emailed: emailed.customer_emailed }),
      { headers: JSON_HEADERS },
    );
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
