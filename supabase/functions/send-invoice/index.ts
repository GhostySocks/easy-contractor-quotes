// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
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
const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Easy Contractor Quotes <no-reply@easycontractorquotes.com>';

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
      .select('business_name')
      .eq('id', userId)
      .maybeSingle();
    const businessName = profile?.business_name ?? 'Your contractor';

    await sendEmailViaResend({
      to: input.recipient.email,
      toName: input.recipient.name,
      businessName,
      invoice: {
        line_items: (invoice.line_items ?? []) as LineItem[],
        subtotal_cents: invoice.subtotal_cents,
        tax_cents: invoice.tax_cents,
        total_cents: invoice.total_cents,
        short_id: invoice.id.slice(0, 8).toUpperCase(),
      },
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

async function sendEmailViaResend(input: {
  to: string;
  toName: string | null;
  businessName: string;
  invoice: {
    line_items: LineItem[];
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    short_id: string;
  };
}): Promise<void> {
  // @ts-expect-error — Deno env access
  const apiKey = Deno.env.get('RESEND_API_KEY');
  // @ts-expect-error — Deno env access
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? DEFAULT_FROM;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const toHeader = input.toName ? `${input.toName} <${input.to}>` : input.to;
  const subject = `Invoice from ${input.businessName} · $${(input.invoice.total_cents / 100).toFixed(2)}`;

  const resp = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toHeader,
      subject,
      html: renderInvoiceEmail(input),
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body.slice(0, 200)}`);
  }
}

function renderInvoiceEmail(input: {
  toName: string | null;
  businessName: string;
  invoice: {
    line_items: LineItem[];
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    short_id: string;
  };
}): string {
  const greeting = input.toName ? `Hi ${escapeHtml(input.toName)},` : 'Hi,';
  const rows = input.invoice.line_items
    .map(
      (item) => `<tr>
        <td style="padding: 8px 0; color: #4A4A4A;">${escapeHtml(item.label)}</td>
        <td style="padding: 8px 0; text-align: right; color: #1A1A1A; font-weight: 600;">
          $${(item.total_cents / 100).toFixed(2)}
        </td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1A1A1A; background: #F7F5EF; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 14px; padding: 32px;">
        <tr><td>
          <p style="margin: 0 0 8px; color: #8A8A8A; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700;">
            Invoice #${escapeHtml(input.invoice.short_id)}
          </p>
          <h1 style="margin: 0 0 24px; font-size: 32px;">
            $${(input.invoice.total_cents / 100).toFixed(2)}
          </h1>

          <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.55;">
            ${greeting}<br/>
            ${escapeHtml(input.businessName)} has sent you an invoice for the work
            completed. Summary below.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #E8E4D7; border-bottom: 1px solid #E8E4D7; padding: 8px 0;">
            ${rows}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
            <tr>
              <td style="color: #4A4A4A;">Subtotal</td>
              <td style="text-align: right;">$${(input.invoice.subtotal_cents / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #4A4A4A;">Tax</td>
              <td style="text-align: right;">$${(input.invoice.tax_cents / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding-top: 12px; border-top: 1px solid #E8E4D7; font-weight: 800; font-size: 18px;">Total</td>
              <td style="padding-top: 12px; border-top: 1px solid #E8E4D7; text-align: right; font-weight: 800; font-size: 18px;">
                $${(input.invoice.total_cents / 100).toFixed(2)}
              </td>
            </tr>
          </table>

          <p style="margin: 32px 0 0; color: #8A8A8A; font-size: 13px;">
            Questions about this invoice? Reply directly to this email to reach
            ${escapeHtml(input.businessName)}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
