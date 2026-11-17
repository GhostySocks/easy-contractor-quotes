// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { addChangeOrderToInvoice, type ChangeOrderLine, type InvoiceLine } from './change-order.ts';
import {
  changeOrderDeclinedEmail,
  changeOrderSignedContractorEmail,
  changeOrderSignedCustomerEmail,
  type ChangeOrderEmailInput,
} from './change-order-emails.ts';
import { logoUrlFor, sendEmail } from './email.ts';
import { cleanUserAgent, sha256Hex, type SignatureMethod } from './signing-record.ts';

/**
 * Signing and declining a change order, shared by the customer's link
 * (customer-sign-submit, no login) and in-person signing (change-order,
 * contractor's login). Runs with the service-role client; each caller has
 * already established that this person may act on this change order, by
 * token or by ownership.
 *
 * Signing does three things that must agree: locks the change order, moves
 * the job total to the figure the customer signed for, and adds the lines to
 * an open invoice.
 */

export type Outcome<T> = ({ ok: true } & T) | { ok: false; status: number; message: string };

const fail = (status: number, message: string) => ({ ok: false as const, status, message });

type ChangeOrder = {
  id: string;
  user_id: string;
  job_id: string;
  customer_id: string | null;
  number: number;
  description: string;
  line_items: ChangeOrderLine[];
  tax_cents: number;
  total_cents: number;
  previous_total_cents: number;
  new_total_cents: number;
  body_markdown: string;
  status: 'draft' | 'sent' | 'signed' | 'declined';
  signed_at: string | null;
};

const COLUMNS =
  'id, user_id, job_id, customer_id, number, description, line_items, tax_cents, total_cents, ' +
  'previous_total_cents, new_total_cents, body_markdown, status, signed_at';

async function load(admin: SupabaseClient, id: string): Promise<ChangeOrder | null> {
  const { data } = await admin.from('change_orders').select(COLUMNS).eq('id', id).maybeSingle();
  return (data as ChangeOrder | null) ?? null;
}

/** Who to write to and how the emails are dressed, for one change order. */
async function emailContext(admin: SupabaseClient, co: ChangeOrder, url: string) {
  const [{ data: profile }, { data: customer }, { data: owner }] = await Promise.all([
    admin
      .from('profiles')
      .select('business_name, logo_url, business_phone, business_email')
      .eq('id', co.user_id)
      .maybeSingle(),
    co.customer_id
      ? admin.from('customers').select('name, email').eq('id', co.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.auth.admin.getUserById(co.user_id),
  ]);
  const businessName = (profile?.business_name as string | undefined) ?? 'Your contractor';
  const base: ChangeOrderEmailInput = {
    businessName,
    logoUrl: await logoUrlFor(admin, profile?.logo_url as string | null | undefined),
    contact: {
      phone: profile?.business_phone as string | null | undefined,
      email: profile?.business_email as string | null | undefined,
    },
    customerName: (customer?.name as string | undefined) ?? null,
    number: co.number,
    description: co.description,
    changeCents: co.total_cents,
    previousTotalCents: co.previous_total_cents,
    newTotalCents: co.new_total_cents,
    url,
  };
  const contractorEmail = owner?.user?.email?.trim() || null;
  return {
    base,
    customerEmail: (customer?.email as string | null | undefined)?.trim() || null,
    contractorEmail,
    replyTo: (profile?.business_email as string | null | undefined) || contractorEmail,
  };
}

export type SignInput = {
  signature_svg: string;
  signer_name: string | null;
  consent: boolean;
  method: SignatureMethod;
  ip: string | null;
  user_agent: string | null;
};

export async function signChangeOrder(
  admin: SupabaseClient,
  id: string,
  input: SignInput,
  viewUrl: string,
): Promise<Outcome<{ customer_emailed: boolean }>> {
  const co = await load(admin, id);
  if (!co) return fail(404, 'change order not found');
  if (co.signed_at) return fail(409, 'This change order is already signed.');
  if (co.status === 'declined') return fail(409, 'This change order was declined.');

  // The customer signs for a new total. If the job's total has moved since
  // this was written (another change order was signed), that figure is wrong
  // and the contractor has to save it again.
  const { data: job } = await admin
    .from('jobs')
    .select('id, total_cents, status')
    .eq('id', co.job_id)
    .maybeSingle();
  if (!job) return fail(404, 'job not found');
  if (Number(job.total_cents ?? 0) !== Number(co.previous_total_cents)) {
    return fail(
      409,
      'The job total has changed since this change order was written. Ask the contractor to update and resend it.',
    );
  }
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status, line_items, subtotal_cents, tax_cents, total_cents')
    .eq('job_id', co.job_id)
    .maybeSingle();
  if (invoice && (invoice.status === 'paid' || invoice.status === 'refunded')) {
    return fail(409, 'This job has already been paid, so it can no longer be changed.');
  }

  // One update, guarded on still being open: two taps can't both sign.
  const signedAt = new Date().toISOString();
  const { data: rows, error } = await admin
    .from('change_orders')
    .update({
      status: 'signed',
      signature_svg: input.signature_svg,
      signed_at: signedAt,
      signed_ip: input.ip,
      signer_name: input.signer_name,
      signed_consent_at: input.consent && input.signer_name ? signedAt : null,
      signed_user_agent: cleanUserAgent(input.user_agent),
      signature_method: input.method,
      body_sha256: await sha256Hex(co.body_markdown),
    })
    .eq('id', co.id)
    .is('signed_at', null)
    .in('status', ['draft', 'sent'])
    .select('id');
  if (error) return fail(500, `sign failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    return fail(409, 'This change order was just signed or changed. Reload the page.');
  }

  // Move the job to the total that was signed for. Guarded on the total this
  // request checked, so two change orders can't both apply to the same base.
  // (A job from before totals were recorded has none; it counted as 0 above.)
  const jobUpdate = admin
    .from('jobs')
    .update({ total_cents: co.new_total_cents })
    .eq('id', co.job_id);
  const { data: moved, error: jobErr } = await (
    job.total_cents === null
      ? jobUpdate.is('total_cents', null)
      : jobUpdate.eq('total_cents', co.previous_total_cents)
  ).select('id');
  if (jobErr || !moved || moved.length === 0) {
    console.error('[change-order] signed but job total not updated', co.id, jobErr?.message);
  }

  let invoiceUpdated = false;
  if (invoice) {
    const next = addChangeOrderToInvoice(
      {
        line_items: (invoice.line_items ?? []) as InvoiceLine[],
        subtotal_cents: Number(invoice.subtotal_cents),
        tax_cents: Number(invoice.tax_cents),
        total_cents: Number(invoice.total_cents),
      },
      { number: co.number, lines: co.line_items, tax_cents: Number(co.tax_cents) },
    );
    const { error: invErr } = await admin.from('invoices').update(next).eq('id', invoice.id);
    if (invErr) console.error('[change-order] invoice not updated', co.id, invErr.message);
    else invoiceUpdated = true;
  }

  // Emails are best effort; the signature is already saved.
  let customerEmailed = false;
  try {
    const ctx = await emailContext(admin, co, viewUrl);
    const signed = {
      ...ctx.base,
      customerName: input.signer_name ?? ctx.base.customerName,
      bodyMarkdown: co.body_markdown,
      invoiceUpdated,
      record: {
        signer_name: input.signer_name,
        signed_consent_at: input.consent && input.signer_name ? signedAt : null,
        signed_at: signedAt,
        signed_ip: input.ip,
        signed_user_agent: cleanUserAgent(input.user_agent),
        signature_method: input.method,
        body_sha256: await sha256Hex(co.body_markdown),
      },
    };
    if (ctx.customerEmail) {
      try {
        await sendEmail({
          to: ctx.customerEmail,
          toName: ctx.base.customerName,
          replyTo: ctx.replyTo,
          ...changeOrderSignedCustomerEmail(signed),
        });
        customerEmailed = true;
      } catch (err) {
        console.warn('[change-order] customer copy failed', (err as Error).message);
      }
    }
    if (ctx.contractorEmail) {
      try {
        await sendEmail({ to: ctx.contractorEmail, ...changeOrderSignedContractorEmail(signed) });
      } catch (err) {
        console.warn('[change-order] contractor notice failed', (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[change-order] signed emails failed', (err as Error).message);
  }

  return { ok: true, customer_emailed: customerEmailed };
}

export async function declineChangeOrder(
  admin: SupabaseClient,
  id: string,
  viewUrl: string,
): Promise<Outcome<Record<never, never>>> {
  const co = await load(admin, id);
  if (!co) return fail(404, 'change order not found');
  if (co.signed_at) return fail(409, 'This change order is already signed.');
  if (co.status === 'declined') return { ok: true };

  const { data: rows, error } = await admin
    .from('change_orders')
    .update({ status: 'declined', declined_at: new Date().toISOString() })
    .eq('id', co.id)
    .is('signed_at', null)
    .in('status', ['draft', 'sent'])
    .select('id');
  if (error) return fail(500, `decline failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    return fail(409, 'This change order was just signed or changed. Reload the page.');
  }

  try {
    const ctx = await emailContext(admin, co, viewUrl);
    if (ctx.contractorEmail) {
      await sendEmail({ to: ctx.contractorEmail, ...changeOrderDeclinedEmail(ctx.base) });
    }
  } catch (err) {
    console.warn('[change-order] decline notice failed', (err as Error).message);
  }
  return { ok: true };
}
