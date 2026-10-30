import type { LineItem } from './ai';
import { supabase } from './supabase';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type InvoiceRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  customer_id: string | null;
  quote_id: string | null;
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  stripe_payment_intent: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type UnpaidSummary = {
  totalCents: number;
  unpaidCount: number;
  overdueCount: number;
};

/**
 * Aggregates for the Home "Money Pending" card. Sums unpaid + partial invoices
 * for the current user, and counts how many of those were sent more than
 * OVERDUE_DAYS ago. We don't track an explicit due date yet, so sent_at is the
 * proxy — close enough until invoice terms are user-configurable.
 */
const OVERDUE_DAYS = 30;

export async function fetchUnpaidSummary(): Promise<UnpaidSummary> {
  const { data, error } = await supabase
    .from('invoices')
    .select('total_cents, status, sent_at')
    .in('status', ['unpaid', 'partial']);
  if (error) {
    console.warn('[invoices] unpaid-summary failed', error.message);
    return { totalCents: 0, unpaidCount: 0, overdueCount: 0 };
  }
  const cutoff = Date.now() - OVERDUE_DAYS * 86400000;
  let totalCents = 0;
  let overdueCount = 0;
  for (const row of data ?? []) {
    totalCents += row.total_cents ?? 0;
    if (row.sent_at && new Date(row.sent_at).getTime() < cutoff) overdueCount += 1;
  }
  return { totalCents, unpaidCount: data?.length ?? 0, overdueCount };
}

export async function fetchInvoice(id: string): Promise<InvoiceRow | null> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[invoices] fetch failed', error.message);
    return null;
  }
  return (data as InvoiceRow) ?? null;
}

export async function fetchInvoiceByJob(jobId: string): Promise<InvoiceRow | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[invoices] fetch-by-job failed', error.message);
    return null;
  }
  return (data as InvoiceRow) ?? null;
}

type CreateFromQuoteInput = {
  user_id: string;
  job_id: string;
  customer_id: string | null;
  quote_id: string;
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
};

export type SendInvoiceInput = {
  invoice_id: string;
  recipient: {
    name: string | null;
    email: string;
  };
};

export type SendInvoiceResult = {
  sent_at: string;
};

export async function sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult> {
  const { data, error } = await supabase.functions.invoke<SendInvoiceResult>('send-invoice', {
    body: input,
  });
  if (error) {
    throw new Error(`send-invoice failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('send-invoice returned no data');
  }
  return data;
}

/**
 * Record payment received outside the app (cash, check, Zelle). Also moves
 * the job to 'paid' so the job list and customer value reflect it. Stripe
 * payments will set these from the webhook instead (punch list Phase 3).
 */
export async function markInvoicePaid(invoice: InvoiceRow): Promise<InvoiceRow | null> {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .select('*')
    .single();
  if (error) {
    console.warn('[invoices] mark paid failed', error.message);
    return null;
  }
  if (invoice.job_id) {
    const { error: jobErr } = await supabase
      .from('jobs')
      .update({ status: 'paid' })
      .eq('id', invoice.job_id);
    if (jobErr) console.warn('[invoices] job paid status failed', jobErr.message);
  }
  return data as InvoiceRow;
}

/** Save edited actuals. Only valid before the invoice is sent (see invoiceEditable). */
export async function updateInvoiceTotals(
  id: string,
  totals: Pick<InvoiceRow, 'line_items' | 'subtotal_cents' | 'tax_cents' | 'total_cents'>,
): Promise<InvoiceRow | null> {
  const { data, error } = await supabase
    .from('invoices')
    .update(totals)
    .eq('id', id)
    .is('sent_at', null)
    .select('*')
    .single();
  if (error) {
    console.warn('[invoices] update totals failed', error.message);
    return null;
  }
  return data as InvoiceRow;
}

/**
 * Creates a new invoice row mirroring a quote. Idempotent-ish: if an
 * invoice already exists for this job, returns it instead of inserting.
 */
export async function createInvoiceFromQuote(
  input: CreateFromQuoteInput,
): Promise<InvoiceRow | null> {
  const existing = await fetchInvoiceByJob(input.job_id);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: input.user_id,
      job_id: input.job_id,
      customer_id: input.customer_id,
      quote_id: input.quote_id,
      line_items: input.line_items,
      subtotal_cents: input.subtotal_cents,
      tax_cents: input.tax_cents,
      total_cents: input.total_cents,
      status: 'unpaid',
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[invoices] create failed', error.message);
    return null;
  }
  return data as InvoiceRow;
}
