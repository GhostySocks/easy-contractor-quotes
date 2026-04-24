import type { LineItem } from './ai';
import { supabase } from './supabase';

export type SendChannel = 'email' | 'sms';

export type SendQuoteInput = {
  quote_id: string;
  channels: SendChannel[];
  recipient: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export type SendQuoteResult = {
  email_sent: boolean;
  email_error: string | null;
  sms_url: string | null;
  quote_sent_at: string;
};

export async function sendQuote(input: SendQuoteInput): Promise<SendQuoteResult> {
  const { data, error } = await supabase.functions.invoke<SendQuoteResult>('send-quote', {
    body: input,
  });
  if (error) {
    throw new Error(`send-quote failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('send-quote returned no data');
  }
  return data;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export type QuoteRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  customer_id: string | null;
  ai_generation_ms: number | null;
  scope_of_work: string | null;
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  total_low_cents: number | null;
  total_high_cents: number | null;
  state_notes: string | null;
  status: QuoteStatus;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export async function fetchQuote(id: string): Promise<QuoteRow | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[quotes] fetch failed', error.message);
    return null;
  }
  return (data as QuoteRow) ?? null;
}

export async function updateQuote(id: string, patch: Partial<QuoteRow>): Promise<QuoteRow | null> {
  const { data, error } = await supabase
    .from('quotes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[quotes] update failed', error.message);
    return null;
  }
  return data as QuoteRow;
}

export async function fetchLatestDraftForUser(userId: string): Promise<QuoteRow | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[quotes] fetch latest failed', error.message);
    return null;
  }
  return (data as QuoteRow) ?? null;
}
