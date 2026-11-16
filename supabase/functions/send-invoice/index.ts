// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { invoiceEmail } from '../_shared/customer-emails.ts';
import { logoUrlFor, sendEmail } from '../_shared/email.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

/**
 * Email-only invoice delivery via Resend. Mirrors the email half of
 * send-quote. SMS is intentionally skipped — customers want to see the
 * itemized document, not a text blob. If they want to text it, the
 * contractor can share the email thread natively.
 */

type SendInput = {
  invoice_id: string;
  recipient: {
    name: string | null;
    email: string;
  };
};

type LineItem = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

type SendResult = {
  sent_at: string;
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

    if (!input.invoice_id) throw new HttpError(400, 'invoice_id is required');
    if (!input.recipient?.email) throw new HttpError(400, 'recipient.email is required');

    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, line_items, subtotal_cents, tax_cents, total_cents')
      .eq('id', input.invoice_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (invoiceErr || !invoice) {
      throw new HttpError(404, 'invoice not found');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_name, logo_url')
      .eq('id', userId)
      .maybeSingle();
    const businessName = profile?.business_name ?? 'Your contractor';

    // The email invites a reply and the From address is no-reply, so replies
    // go to the contractor.
    const { data: me } = await supabase.auth.getUser();
    await sendEmail({
      to: input.recipient.email,
      toName: input.recipient.name,
      replyTo: me?.user?.email ?? null,
      ...invoiceEmail({
        businessName,
        logoUrl: await logoUrlFor(supabase, profile?.logo_url),
        customerName: input.recipient.name,
        shortId: invoice.id.slice(0, 8).toUpperCase(),
        lineItems: (invoice.line_items ?? []) as LineItem[],
        subtotalCents: invoice.subtotal_cents,
        taxCents: invoice.tax_cents,
        totalCents: invoice.total_cents,
      }),
    });

    const sentAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ sent_at: sentAt })
      .eq('id', invoice.id)
      .eq('user_id', userId);
    if (updateErr) {
      throw new HttpError(500, `invoice update failed: ${updateErr.message}`);
    }

    const result: SendResult = { sent_at: sentAt };
    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status, headers: corsHeaders });
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});
