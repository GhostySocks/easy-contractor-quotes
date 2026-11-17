import { callFunctionOnce } from './ai';
import { supabase } from './supabase';
import type { ChangeOrderLine } from '../supabase/functions/_shared/change-order';

/**
 * Change orders: a priced, signed change to a job that already has a signed
 * agreement. The app reads them directly (RLS: own rows only) and deletes an
 * unsigned one directly; everything else goes through the change-order edge
 * function, which computes the money and writes the document.
 */

export type ChangeOrderStatus = 'draft' | 'sent' | 'signed' | 'declined';

export type ChangeOrderRow = {
  id: string;
  user_id: string;
  job_id: string;
  customer_id: string | null;
  number: number;
  description: string;
  line_items: ChangeOrderLine[];
  subtotal_cents: number;
  tax_cents: number;
  /** What this change adds to the job total; negative for a net credit. */
  total_cents: number;
  previous_total_cents: number;
  new_total_cents: number;
  extra_days: number;
  body_markdown: string;
  status: ChangeOrderStatus;
  sent_at: string | null;
  declined_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  created_at: string;
};

const COLUMNS =
  'id, user_id, job_id, customer_id, number, description, line_items, subtotal_cents, tax_cents, ' +
  'total_cents, previous_total_cents, new_total_cents, extra_days, body_markdown, status, ' +
  'sent_at, declined_at, signed_at, signer_name, created_at';

export async function listChangeOrders(jobId: string): Promise<ChangeOrderRow[]> {
  const { data, error } = await supabase
    .from('change_orders')
    .select(COLUMNS)
    .eq('job_id', jobId)
    .order('number', { ascending: true });
  if (error) {
    console.warn('[change-orders] list failed', error.message);
    return [];
  }
  return (data as unknown as ChangeOrderRow[]) ?? [];
}

export async function fetchChangeOrder(id: string): Promise<ChangeOrderRow | null> {
  const { data, error } = await supabase
    .from('change_orders')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('[change-orders] fetch failed', error.message);
    return null;
  }
  return (data as unknown as ChangeOrderRow) ?? null;
}

export type SaveChangeOrderInput = {
  id?: string;
  job_id: string;
  description: string;
  line_items: ChangeOrderLine[];
  extra_days: number;
};

/** Create or edit an unsigned change order. Throws a message the screen can show. */
export async function saveChangeOrder(input: SaveChangeOrderInput): Promise<ChangeOrderRow> {
  return await callFunctionOnce<ChangeOrderRow>('change-order', { action: 'save', ...input });
}

/** Ask the AI to suggest line items for a described change. Nothing is saved. */
export async function draftChangeOrderLines(
  jobId: string,
  description: string,
): Promise<ChangeOrderLine[]> {
  const result = await callFunctionOnce<{ line_items: ChangeOrderLine[] }>('change-order', {
    action: 'draft',
    job_id: jobId,
    description,
  });
  return result.line_items;
}

export type SendChangeOrderResult = {
  email_sent: boolean;
  email_error: string | null;
  sms_url: string | null;
  sent_at: string;
};

export async function sendChangeOrder(input: {
  id: string;
  channels: ('email' | 'sms')[];
  recipient: { name: string | null; email: string | null; phone: string | null };
}): Promise<SendChangeOrderResult> {
  return await callFunctionOnce<SendChangeOrderResult>('change-order', {
    action: 'send',
    ...input,
  });
}

/** The customer signs on the contractor's phone. */
export async function signChangeOrderInPerson(input: {
  id: string;
  signature_svg: string;
  signer_name: string;
  consent: boolean;
}): Promise<ChangeOrderRow> {
  return await callFunctionOnce<ChangeOrderRow>('change-order', { action: 'sign', ...input });
}

/** Delete one that was never signed. RLS refuses a signed one. */
export async function deleteChangeOrder(id: string): Promise<boolean> {
  const { error } = await supabase.from('change_orders').delete().eq('id', id);
  if (error) console.warn('[change-orders] delete failed', error.message);
  return !error;
}

/** Signed change orders for a job, oldest first: what joins its invoice. */
export async function listSignedChangeOrders(jobId: string): Promise<ChangeOrderRow[]> {
  return (await listChangeOrders(jobId)).filter((co) => co.status === 'signed');
}

export const CHANGE_ORDER_STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting signature',
  signed: 'Signed',
  declined: 'Declined',
};
