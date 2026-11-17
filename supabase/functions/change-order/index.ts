// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  changeOrderTotals,
  cleanDescription,
  cleanExtraDays,
  cleanLines,
  renderChangeOrder,
  type ChangeOrderLine,
} from '../_shared/change-order.ts';
import { changeOrderRequestEmail } from '../_shared/change-order-emails.ts';
import { signChangeOrder } from '../_shared/change-order-sign.ts';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { logoUrlFor, sendEmail } from '../_shared/email.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';
import { cleanSignerName, isAcceptableSignatureSvg } from '../_shared/signing-record.ts';

/**
 * Change orders for the signed-in contractor. One function, four actions:
 *
 *   save   create or edit an unsigned change order. The server computes the
 *          money, numbers it, and renders the document; the app never writes
 *          the table itself (it has no insert or update policy).
 *   draft  suggest line items for a described change. Nothing is saved.
 *   send   email the signing link and/or return an sms: link, like send-quote.
 *   sign   the customer signs in person on the contractor's phone.
 *
 * Every action re-checks the subscription (CLAUDE.md §3.4) and that the job
 * or change order belongs to the caller, using the caller's own client so
 * RLS applies. Writes then go through the service role.
 */

type Input =
  | {
      action: 'save';
      id?: string;
      job_id: string;
      description: unknown;
      line_items: unknown;
      extra_days?: unknown;
    }
  | { action: 'draft'; job_id: string; description: unknown }
  | {
      action: 'send';
      id: string;
      channels: Array<'email' | 'sms'>;
      recipient: { name: string | null; email: string | null; phone: string | null };
    }
  | {
      action: 'sign';
      id: string;
      signature_svg: unknown;
      signer_name?: unknown;
      consent?: unknown;
    };

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: JSON_HEADERS });

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await requireActiveSubscription(req);
    const input = (await req.json()) as Input;
    const admin = serviceClient();

    switch (input.action) {
      case 'save':
        return json(await save(supabase, admin, userId, input));
      case 'draft':
        return json(await draft(supabase, userId, input));
      case 'send':
        return json(await send(req, supabase, admin, userId, input));
      case 'sign':
        return json(await signInPerson(req, supabase, admin, input));
      default:
        throw new HttpError(400, 'unknown action');
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status, headers: corsHeaders });
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

function serviceClient(): SupabaseClient {
  // @ts-expect-error — Deno env access
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-expect-error — Deno env access
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new HttpError(500, 'service credentials are not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Job = {
  id: string;
  customer_id: string | null;
  description: string | null;
  status: string;
  total_cents: number | null;
  site_address_line1: string | null;
  site_city: string | null;
  site_state_code: string | null;
  site_postal_code: string | null;
};

/** The caller's own job, read through RLS, and checked to still be changeable. */
async function loadOpenJob(supabase: SupabaseClient, jobId: string): Promise<Job> {
  if (!jobId) throw new HttpError(400, 'job_id is required');
  const { data: job } = await supabase
    .from('jobs')
    .select(
      'id, customer_id, description, status, total_cents, ' +
        'site_address_line1, site_city, site_state_code, site_postal_code',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (!job) throw new HttpError(404, 'job not found');
  if (job.status === 'cancelled') {
    throw new HttpError(409, 'This job is cancelled, so it can no longer be changed.');
  }
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('job_id', jobId)
    .maybeSingle();
  if (job.status === 'paid' || invoice?.status === 'paid' || invoice?.status === 'refunded') {
    throw new HttpError(409, 'This job has been paid, so it can no longer be changed.');
  }
  return job as Job;
}

function siteLine(job: Job): string | null {
  if (!job.site_address_line1 && !job.site_city) return null;
  const stateZip = [job.site_state_code, job.site_postal_code].filter(Boolean).join(' ');
  return [job.site_address_line1, job.site_city, stateZip].filter(Boolean).join(', ');
}

async function save(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: Extract<Input, { action: 'save' }>,
) {
  const description = cleanDescription(input.description);
  if (!description) throw new HttpError(400, 'Describe what is changing in a sentence or two.');
  const lines = cleanLines(input.line_items);
  if (!lines) {
    throw new HttpError(400, 'Add at least one line with a name, a quantity and a price.');
  }
  const job = await loadOpenJob(supabase, input.job_id);

  const [{ data: profile }, { data: customer }, { data: contract }] = await Promise.all([
    supabase
      .from('profiles')
      .select('business_name, state_code, default_tax_rate')
      .eq('id', userId)
      .maybeSingle(),
    job.customer_id
      ? supabase.from('customers').select('name').eq('id', job.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('contracts')
      .select('signed_at, state_code')
      .eq('job_id', job.id)
      .not('signed_at', 'is', null)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const previousTotal = Number(job.total_cents ?? 0);
  const totals = changeOrderTotals(lines, Number(profile?.default_tax_rate ?? 0), previousTotal);
  if (totals.new_total_cents < 0) {
    throw new HttpError(400, 'These credits would take the job total below zero.');
  }
  const extraDays = cleanExtraDays(input.extra_days);
  const stateCode = (job.site_state_code ?? contract?.state_code ?? profile?.state_code ?? '')
    .toString()
    .toUpperCase();
  if (stateCode.length !== 2) {
    throw new HttpError(400, 'Set your state in Settings > Business before creating one.');
  }

  let existing: { id: string; number: number; status: string; signed_at: string | null } | null =
    null;
  if (input.id) {
    const { data } = await supabase
      .from('change_orders')
      .select('id, number, status, signed_at, job_id')
      .eq('id', input.id)
      .maybeSingle();
    if (!data || data.job_id !== job.id) throw new HttpError(404, 'change order not found');
    if (data.signed_at) {
      throw new HttpError(409, 'A signed change order cannot be edited. Create a new one.');
    }
    existing = data;
  }

  let number = existing?.number;
  if (!number) {
    const { data: latest } = await supabase
      .from('change_orders')
      .select('number')
      .eq('job_id', job.id)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();
    number = ((latest?.number as number | undefined) ?? 0) + 1;
  }

  const body_markdown = renderChangeOrder({
    number,
    business_name: (profile?.business_name ?? 'Contractor').toString(),
    customer_name: (customer?.name ?? 'Customer').toString(),
    agreement_signed_at: contract?.signed_at ?? null,
    job_site: siteLine(job),
    state_code: stateCode,
    description,
    lines,
    totals,
    extra_days: extraDays,
    generated_at: new Date().toISOString(),
  });

  // Saving always goes back to a draft with a fresh link: if this was already
  // sent (or declined), the link the customer has stops working, so they can
  // never sign text other than the latest.
  const row = {
    description,
    line_items: lines,
    ...totals,
    extra_days: extraDays,
    body_markdown,
    status: 'draft',
    sent_at: null,
    declined_at: null,
    signing_token: mintSigningToken(),
    signing_token_expires_at: daysFromNowISO(30),
  };

  const query = existing
    ? admin
        .from('change_orders')
        .update(row)
        .eq('id', existing.id)
        .eq('user_id', userId)
        .is('signed_at', null)
    : admin
        .from('change_orders')
        .insert({ ...row, user_id: userId, job_id: job.id, customer_id: job.customer_id, number });
  const { data: saved, error } = await query.select('*').single();
  if (error || !saved) {
    throw new HttpError(500, `save failed: ${error?.message ?? 'no row'}`);
  }
  return saved;
}

/** The caller's own unsigned change order, read through RLS. */
async function loadOpenChangeOrder(supabase: SupabaseClient, id: string) {
  if (!id) throw new HttpError(400, 'id is required');
  const { data: co } = await supabase
    .from('change_orders')
    .select(
      'id, job_id, customer_id, number, description, total_cents, previous_total_cents, ' +
        'new_total_cents, status, signed_at, signing_token',
    )
    .eq('id', id)
    .maybeSingle();
  if (!co) throw new HttpError(404, 'change order not found');
  if (co.signed_at) throw new HttpError(409, 'This change order is already signed.');
  // Its new total must still start from the job's current total.
  const job = await loadOpenJob(supabase, co.job_id);
  if (Number(job.total_cents ?? 0) !== Number(co.previous_total_cents)) {
    throw new HttpError(
      409,
      'The job total has changed since this was written. Open it and save it again first.',
    );
  }
  return co;
}

function signUrlFor(req: Request, token: string): string {
  const url = new URL(req.url);
  const base =
    // @ts-expect-error — Deno env access
    Deno.env.get('CUSTOMER_SIGN_BASE_URL') ??
    `${url.origin}${url.pathname.replace('/change-order', '/customer-sign')}`;
  return `${base}?token=${encodeURIComponent(token)}`;
}

async function send(
  req: Request,
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: Extract<Input, { action: 'send' }>,
) {
  if (!Array.isArray(input.channels) || input.channels.length === 0) {
    throw new HttpError(400, 'channels must be a non-empty array');
  }
  const wantsEmail = input.channels.includes('email');
  const wantsSms = input.channels.includes('sms');
  if (wantsEmail && !input.recipient?.email) {
    throw new HttpError(400, 'recipient.email is required when channels includes email');
  }
  if (wantsSms && !input.recipient?.phone) {
    throw new HttpError(400, 'recipient.phone is required when channels includes sms');
  }

  const co = await loadOpenChangeOrder(supabase, input.id);
  if (co.status === 'declined') {
    throw new HttpError(409, 'This change order was declined. Edit and save it to send it again.');
  }
  if (!co.signing_token) throw new HttpError(500, 'change order is missing a signing token');
  const signUrl = signUrlFor(req, co.signing_token);

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, logo_url, business_phone, business_email')
    .eq('id', userId)
    .maybeSingle();
  const businessName = profile?.business_name ?? 'Your contractor';

  let email_sent = false;
  let email_error: string | null = null;
  if (wantsEmail) {
    try {
      const { data: me } = await supabase.auth.getUser();
      await sendEmail({
        to: input.recipient.email as string,
        toName: input.recipient.name,
        replyTo: profile?.business_email || me?.user?.email || null,
        ...changeOrderRequestEmail({
          businessName,
          logoUrl: await logoUrlFor(supabase, profile?.logo_url),
          contact: { phone: profile?.business_phone, email: profile?.business_email },
          customerName: input.recipient.name,
          number: co.number,
          description: co.description,
          changeCents: Number(co.total_cents),
          previousTotalCents: Number(co.previous_total_cents),
          newTotalCents: Number(co.new_total_cents),
          url: signUrl,
        }),
      });
      email_sent = true;
    } catch (err) {
      email_error = err instanceof Error ? err.message : 'unknown email error';
    }
  }

  const sms_url = wantsSms
    ? `sms:${input.recipient.phone}?&body=${encodeURIComponent(
        `${businessName} sent you a change order for your job. Review and sign here: ${signUrl}`,
      )}`
    : null;

  const sentAt = new Date().toISOString();
  const { error } = await admin
    .from('change_orders')
    .update({ status: 'sent', sent_at: sentAt })
    .eq('id', co.id)
    .eq('user_id', userId)
    .is('signed_at', null)
    .in('status', ['draft', 'sent']);
  if (error) throw new HttpError(500, `status update failed: ${error.message}`);

  return { email_sent, email_error, sms_url, sent_at: sentAt };
}

async function signInPerson(
  req: Request,
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: Extract<Input, { action: 'sign' }>,
) {
  if (!isAcceptableSignatureSvg(input.signature_svg)) {
    throw new HttpError(400, 'signature_svg is required');
  }
  const signerName = cleanSignerName(input.signer_name);
  if (!signerName || input.consent !== true) {
    throw new HttpError(400, "Enter the customer's full name and tick the box to sign.");
  }
  // Ownership and that it is still open, through RLS, before the service role acts.
  const co = await loadOpenChangeOrder(supabase, input.id);
  if (co.status === 'declined') {
    throw new HttpError(409, 'This change order was declined. Edit and save it first.');
  }

  const result = await signChangeOrder(
    admin,
    co.id,
    {
      signature_svg: input.signature_svg,
      signer_name: signerName,
      consent: true,
      method: 'drawn',
      ip: firstForwardedIp(req.headers.get('x-forwarded-for')),
      user_agent: req.headers.get('user-agent'),
    },
    co.signing_token ? signUrlFor(req, co.signing_token) : '',
  );
  if (!result.ok) throw new HttpError(result.status, result.message);

  const { data: signed } = await supabase
    .from('change_orders')
    .select('*')
    .eq('id', co.id)
    .maybeSingle();
  return signed;
}

// ---------------------------------------------------------------------------
// Drafting line items with the model

const MODEL_PRIMARY = 'claude-haiku-5-5';
const MODEL_FALLBACK = 'claude-sonnet-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TOOL_NAME = 'return_change_lines';

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    line_items: {
      type: 'array',
      description: '1-5 items for this change only: labor, materials, disposal, or a credit.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          qty: { type: 'number' },
          unit_price_cents: {
            type: 'integer',
            description: 'Cents. Negative for a credit back to the customer.',
          },
        },
        required: ['label', 'qty', 'unit_price_cents'],
      },
    },
  },
  required: ['line_items'],
};

async function draft(
  supabase: SupabaseClient,
  userId: string,
  input: Extract<Input, { action: 'draft' }>,
): Promise<{ line_items: ChangeOrderLine[] }> {
  const description = cleanDescription(input.description);
  if (!description) throw new HttpError(400, 'Describe what is changing in a sentence or two.');
  const job = await loadOpenJob(supabase, input.job_id);
  const { data: profile } = await supabase
    .from('profiles')
    .select('trade, state_code')
    .eq('id', userId)
    .maybeSingle();

  // @ts-expect-error — Deno env access
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new HttpError(500, 'ANTHROPIC_API_KEY is not configured on this project');

  const state = (job.site_state_code ?? profile?.state_code ?? '').toString().toUpperCase();
  const system = [
    'You are a pricing assistant for a solo contractor. A job is already under a signed agreement and the scope is changing. Price ONLY the change, as line items for a change order.',
    '',
    `Trade: ${profile?.trade ?? 'general'}. Job location: ${state || 'US'}.`,
    '',
    'Guidance:',
    '- 1-5 line items: the added or removed labor, materials and disposal for this change alone. Never re-price the original job.',
    '- Prices reflect typical solo-contractor rates for this trade and region.',
    '- Work or materials being REMOVED, or supplied by the customer instead, is a credit: a line with a NEGATIVE unit_price_cents and a label that says what is credited.',
    '- All amounts are integer cents. Quantities are positive. No tax line; the app adds tax.',
    '- Never include a travel, trip or mileage charge; the contractor adds travel separately.',
    '',
    `Return via the ${TOOL_NAME} tool only.`,
  ].join('\n');
  const user = [
    `The job as agreed:\n${(job.description ?? 'Not described.').trim()}`,
    `\nThe change:\n${description}`,
  ].join('\n');

  for (const model of [MODEL_PRIMARY, MODEL_FALLBACK]) {
    const lines = cleanLines(await callModel(apiKey, model, system, user));
    if (lines) return { line_items: lines };
    console.warn('[change-order] draft from', model, 'was not usable');
  }
  throw new HttpError(502, "Couldn't draft the lines. Add them by hand.");
}

async function callModel(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      output_config: { effort: 'low' },
      system,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Return the line items for this change order.',
          input_schema: TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new HttpError(502, `Anthropic error ${resp.status}: ${body.slice(0, 300)}`);
  }
  const result = (await resp.json()) as {
    content: Array<{ type: string; name?: string; input?: { line_items?: unknown } }>;
  };
  const tool = result.content.find((c) => c.type === 'tool_use' && c.name === TOOL_NAME);
  return tool?.input?.line_items ?? null;
}

// ---------------------------------------------------------------------------

/** 32 bytes of CSPRNG randomness, base64url: unguessable and safe in a URL. */
function mintSigningToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function daysFromNowISO(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function firstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
