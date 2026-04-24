// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Runs after a contract is signed by either path (authenticated contractor
 * self-sign or tokenized customer sign). Creates the job the contractor
 * will actually deliver against, links it back to the contract, and flips
 * the quote from `sent` to `accepted`.
 *
 * Uses the service-role client so it runs the same way from both paths —
 * the customer-sign flow has no JWT, and we already trust the caller by
 * token at that point.
 */
export async function onContractSigned(
  admin: SupabaseClient,
  contractId: string,
): Promise<{ job_id: string | null }> {
  const { data: contract, error: contractErr } = await admin
    .from('contracts')
    .select('id, user_id, customer_id, quote_id, job_id')
    .eq('id', contractId)
    .maybeSingle();
  if (contractErr || !contract) {
    console.warn('[post-sign] contract not found', contractErr?.message ?? contractId);
    return { job_id: null };
  }

  // If a job already exists for this contract we're done — signing can
  // race (contractor self-signs after customer already did, etc.).
  if (contract.job_id) return { job_id: contract.job_id };

  if (!contract.quote_id) {
    console.warn('[post-sign] contract has no quote_id — cannot create job');
    return { job_id: null };
  }

  const { data: quote } = await admin
    .from('quotes')
    .select('id, scope_of_work, total_cents, status')
    .eq('id', contract.quote_id)
    .maybeSingle();
  if (!quote) return { job_id: null };

  const { data: insertedJob, error: jobErr } = await admin
    .from('jobs')
    .insert({
      user_id: contract.user_id,
      customer_id: contract.customer_id,
      title: jobTitleFromScope(quote.scope_of_work),
      description: quote.scope_of_work,
      status: 'in_progress',
      total_cents: quote.total_cents,
    })
    .select('id')
    .single();
  if (jobErr || !insertedJob) {
    console.warn('[post-sign] job insert failed', jobErr?.message);
    return { job_id: null };
  }

  const { error: linkErr } = await admin
    .from('contracts')
    .update({ job_id: insertedJob.id })
    .eq('id', contract.id);
  if (linkErr) {
    console.warn('[post-sign] failed to link contract.job_id', linkErr.message);
  }

  // Only move the quote forward if it's not already past 'accepted'.
  if (quote.status === 'sent' || quote.status === 'draft') {
    const { error: quoteErr } = await admin
      .from('quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), job_id: insertedJob.id })
      .eq('id', quote.id);
    if (quoteErr) {
      console.warn('[post-sign] quote status update failed', quoteErr.message);
    }
  }

  return { job_id: insertedJob.id };
}

function jobTitleFromScope(scope: string | null): string {
  const s = (scope ?? '').trim();
  if (!s) return 'Job';
  // First sentence, capped at 60 chars.
  const firstSentence = s.split(/[.!?\n]/)[0].trim();
  const trimmed = firstSentence.length > 0 ? firstSentence : s;
  return trimmed.length > 60 ? trimmed.slice(0, 57).trimEnd() + '…' : trimmed;
}
