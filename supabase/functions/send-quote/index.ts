// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { jobSummary, quoteEmail, startLabel } from '../_shared/customer-emails.ts';
import { logoUrlFor, sendEmail } from '../_shared/email.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

/**
 * Send-quote Edge Function.
 *
 * The MVP "send" flow has two channels:
 *   - email: this function delivers via Resend, server-side.
 *   - sms:   this function does NOT deliver the SMS. It returns a prefilled
 *            sms: URL that the client opens in the contractor's native
 *            Messages app — the message goes from the contractor's real
 *            number. Zero SMS infra cost and higher open rates because the
 *            customer already has that number saved.
 *
 * After either channel succeeds, the quote flips to status='sent' with
 * sent_at set to now(). If email is requested but fails, we still return
 * the sms_url so the contractor has a fallback.
 */

type SendInput = {
  quote_id: string;
  channels: Array<'email' | 'sms'>;
  recipient: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  /** The contractor's time zone (IANA name), so the start date reads right. */
  time_zone?: string | null;
};

type SendResult = {
  email_sent: boolean;
  email_error: string | null;
  sms_url: string | null;
  quote_sent_at: string;
};

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await requireActiveSubscription(req);
    const input = (await req.json()) as SendInput;

    if (!input.quote_id) throw new HttpError(400, 'quote_id is required');
    if (!Array.isArray(input.channels) || input.channels.length === 0) {
      throw new HttpError(400, 'channels must be a non-empty array');
    }
    const wantsEmail = input.channels.includes('email');
    const wantsSms = input.channels.includes('sms');
    if (wantsEmail && !input.recipient.email) {
      throw new HttpError(400, 'recipient.email is required when channels includes email');
    }
    if (wantsSms && !input.recipient.phone) {
      throw new HttpError(400, 'recipient.phone is required when channels includes sms');
    }

    // Look up the contract for this quote (most recent unsigned wins). The
    // contract carries the signing_token which drives every channel below.
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .select('id, signing_token, kind')
      .eq('quote_id', input.quote_id)
      .eq('user_id', userId)
      .is('signed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contractErr || !contract) {
      throw new HttpError(404, 'no unsigned contract for this quote — generate one before sending');
    }
    if (!contract.signing_token) {
      throw new HttpError(500, 'contract is missing a signing token');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_name, logo_url')
      .eq('id', userId)
      .maybeSingle();
    const businessName = profile?.business_name ?? 'Your contractor';

    // @ts-expect-error — Deno env access
    const signBase = Deno.env.get('CUSTOMER_SIGN_BASE_URL') ?? inferSignBase(req);
    const signUrl = `${signBase}?token=${encodeURIComponent(contract.signing_token)}`;

    const smsBody = buildSmsBody(businessName, signUrl);
    const sms_url = wantsSms
      ? `sms:${input.recipient.phone}?&body=${encodeURIComponent(smsBody)}`
      : null;

    let email_sent = false;
    let email_error: string | null = null;
    if (wantsEmail) {
      try {
        const { data: quote } = await supabase
          .from('quotes')
          .select(
            'total_cents, scope_of_work, requested_start_at, ' +
              'site_address_line1, site_city, site_state_code, site_postal_code',
          )
          .eq('id', input.quote_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (!quote) throw new Error('quote not found');
        // The From address is no-reply, so replies go to the contractor.
        const { data: me } = await supabase.auth.getUser();
        await sendEmail({
          to: input.recipient.email as string,
          toName: input.recipient.name,
          replyTo: me?.user?.email ?? null,
          ...quoteEmail({
            businessName,
            logoUrl: await logoUrlFor(supabase, profile?.logo_url),
            customerName: input.recipient.name,
            totalCents: quote.total_cents,
            scopeOfWork: quote.scope_of_work,
            jobSite: siteLine(quote),
            start: startLabel(quote.requested_start_at, input.time_zone),
            signUrl,
          }),
        });
        email_sent = true;
      } catch (err) {
        email_error = err instanceof Error ? err.message : 'unknown email error';
      }
    }

    // Flip the quote to sent. If everything else succeeded but the quote
    // update fails, the send still happened — surface the failure as 500.
    const sentAt = new Date().toISOString();
    const { error: quoteErr } = await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', input.quote_id)
      .eq('user_id', userId);
    if (quoteErr) {
      throw new HttpError(500, `quote status update failed: ${quoteErr.message}`);
    }

    const result: SendResult = { email_sent, email_error, sms_url, quote_sent_at: sentAt };
    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status, headers: corsHeaders });
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

function buildSmsBody(businessName: string, signUrl: string): string {
  return `${businessName} sent you a quote. Review and sign here: ${signUrl}`;
}

function siteLine(q: {
  site_address_line1?: string | null;
  site_city?: string | null;
  site_state_code?: string | null;
  site_postal_code?: string | null;
}): string | null {
  if (!q.site_address_line1 && !q.site_city) return null;
  const stateZip = [q.site_state_code, q.site_postal_code].filter(Boolean).join(' ');
  return [q.site_address_line1, q.site_city, stateZip].filter(Boolean).join(', ');
}

function inferSignBase(req: Request): string {
  // Best-effort: replace the function path so the customer-sign URL lives
  // at the same origin as this one. Used when CUSTOMER_SIGN_BASE_URL is
  // not set (dev and single-project deployments).
  const url = new URL(req.url);
  return `${url.origin}${url.pathname.replace('/send-quote', '/customer-sign')}`;
}
