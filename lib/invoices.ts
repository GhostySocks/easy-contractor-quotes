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
