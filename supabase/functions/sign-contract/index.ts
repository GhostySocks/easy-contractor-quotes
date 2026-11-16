// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';
import { onContractSigned } from '../_shared/post-sign.ts';
import { sendSignedEmails } from '../_shared/signed-notice.ts';
import {
  cleanSignerName,
  cleanUserAgent,
  isAcceptableSignatureSvg,
  sha256Hex,
} from '../_shared/signing-record.ts';

type SignInput = {
  contract_id: string;
  signature_svg: string;
  /** The customer's full name, typed on the contractor's phone before signing. */
  signer_name?: unknown;
  /** True when the customer ticked "I agree to sign electronically". */
  consent?: unknown;
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
    if (!isAcceptableSignatureSvg(input.signature_svg)) {
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
      .select('id, user_id, signed_at, body_markdown, signing_token')
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
    // Builds from before the name and consent were asked in person send
    // neither; their signatures are still accepted, with a thinner record.
    const signerName = cleanSignerName(input.signer_name);
    const consented = input.consent === true && signerName !== null;
    const signedAt = new Date().toISOString();

    const { data: updated, error: updateErr } = await admin
      .from('contracts')
      .update({
        signature_svg: input.signature_svg,
        signed_at: signedAt,
        signed_ip: signedIp,
        signer_name: signerName,
        signed_consent_at: consented ? signedAt : null,
        // Signed in person on the contractor's phone: the device and IP are
        // the contractor's.
        signed_user_agent: cleanUserAgent(req.headers.get('user-agent')),
        signature_method: 'drawn',
        body_sha256: await sha256Hex(existing.body_markdown),
      })
      .eq('id', input.contract_id)
      .is('signed_at', null)
      .select('*')
      .single();
    if (updateErr || !updated) {
      throw new HttpError(500, `sign failed: ${updateErr?.message ?? 'no row'}`);
    }

    // Create the downstream job + flip the quote to accepted. Failures are
    // logged but don't block the 200 response — the signature itself is
    // the contractually meaningful event; a missing job can be reconciled.
    const { job_id } = await onContractSigned(admin, updated.id);

    // Email the customer their copy and the contractor the record.
    if (existing.signing_token) {
      const url = new URL(req.url);
      const signBase =
        // @ts-expect-error — Deno env access
        Deno.env.get('CUSTOMER_SIGN_BASE_URL') ??
        `${url.origin}${url.pathname.replace('/sign-contract', '/customer-sign')}`;
      await sendSignedEmails(
        admin,
        updated.id,
        `${signBase}?token=${encodeURIComponent(existing.signing_token)}`,
      );
    }

    return new Response(JSON.stringify({ ...updated, job_id: job_id ?? updated.job_id }), {
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
