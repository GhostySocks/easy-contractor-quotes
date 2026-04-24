import { supabase } from './supabase';

export type ContractKind = 'work' | 'release';

export type ContractRow = {
  id: string;
  user_id: string;
  quote_id: string | null;
  job_id: string | null;
  customer_id: string | null;
  kind: ContractKind;
  state_code: string;
  body_markdown: string;
  signature_svg: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signing_token: string | null;
  signing_token_expires_at: string | null;
  version: number;
  created_at: string;
};

export async function fetchContract(id: string): Promise<ContractRow | null> {
  const { data, error } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[contracts] fetch failed', error.message);
    return null;
  }
  return (data as ContractRow) ?? null;
}

export async function fetchContractByJob(jobId: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[contracts] fetch-by-job failed', error.message);
    return null;
  }
  return (data as ContractRow) ?? null;
}

/**
 * Update body_markdown for an unsigned contract. The DB trigger + RLS policy
 * reject updates once signed_at is set, so we don't defensively check here.
 */
export async function updateContractBody(
  id: string,
  bodyMarkdown: string,
): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from('contracts')
    .update({ body_markdown: bodyMarkdown })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[contracts] update failed', error.message);
    return null;
  }
  return data as ContractRow;
}

/**
 * Submit an e-signature. Goes through the sign-contract Edge Function so
 * the server can capture the signer's IP and write signed_at as the
 * canonical timestamp. The client never mutates signed_at directly.
 */
export type SignContractInput = {
  contract_id: string;
  signature_svg: string;
};

export async function submitSignature(input: SignContractInput): Promise<ContractRow> {
  const { data, error } = await supabase.functions.invoke<ContractRow>('sign-contract', {
    body: input,
  });
  if (error) {
    throw new Error(`sign-contract failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('sign-contract returned no data');
  }
  return data;
}
