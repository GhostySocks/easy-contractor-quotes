import { contactBackfill, type CustomerPatch } from './customer-form';
import { supabase } from './supabase';

export type CustomerRow = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_code: string | null;
  postal_code: string | null;
  notes: string | null;
  tags: string[];
  lifetime_value_cents: number;
  last_job_at: string | null;
  created_at: string;
};

export async function searchCustomers(query: string, limit = 8): Promise<CustomerRow[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return listRecentCustomers(limit);
  }
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('name', `%${escapeLikeWildcards(trimmed)}%`)
    .order('last_job_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.warn('[customers] search failed', error.message);
    return [];
  }
  return (data as CustomerRow[]) ?? [];
}

export async function fetchCustomer(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[customers] fetch failed', error.message);
    return null;
  }
  return (data as CustomerRow) ?? null;
}

export type UpdateCustomerResult =
  | { ok: true; customer: CustomerRow }
  | { ok: false; message: string };

/** RLS restricts the update to the caller's own rows. */
export async function updateCustomer(
  id: string,
  patch: CustomerPatch,
): Promise<UpdateCustomerResult> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[customers] update failed', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true, customer: data as CustomerRow };
}

/**
 * Save contact details the contractor just used elsewhere (Send sheet, New
 * Quote address) onto the customer, so they never have to retype them.
 * Best-effort: failures are logged, never shown, and never block the caller.
 */
export async function rememberCustomerContact(
  id: string,
  used: { name?: string; email?: string; phone?: string; address_line1?: string; city?: string },
): Promise<void> {
  const existing = await fetchCustomer(id);
  if (!existing) return;
  const patch = contactBackfill(existing, used);
  if (!patch) return;
  await updateCustomer(id, patch);
}

export async function listRecentCustomers(limit = 8): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('last_job_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[customers] list failed', error.message);
    return [];
  }
  return (data as CustomerRow[]) ?? [];
}

export type CustomerWithJobs = CustomerRow & {
  job_count: number;
};

/**
 * Full Customers list with the job count rolled in per row. Used by the
 * Customers tab so we can render the "Repeat" badge (jobs >= 2) without a
 * second round trip. PostgREST returns the embedded aggregate as
 * `{ jobs: [{ count }] }`.
 */
export async function listCustomers(opts?: {
  search?: string;
  limit?: number;
}): Promise<CustomerWithJobs[]> {
  const search = opts?.search?.trim() ?? '';
  const limit = opts?.limit ?? 200;

  let query = supabase
    .from('customers')
    .select('*, jobs(count)')
    .order('last_job_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.ilike('name', `%${escapeLikeWildcards(search)}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[customers] list failed', error.message);
    return [];
  }
  return (data ?? []).map(toCustomerWithJobs);
}

function toCustomerWithJobs(row: unknown): CustomerWithJobs {
  const r = row as CustomerRow & { jobs?: { count: number }[] };
  return { ...r, job_count: r.jobs?.[0]?.count ?? 0 };
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<CustomerRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[customers] cannot create without a session');
    return null;
  }

  const trimmed = input.name.trim();
  if (!trimmed) return null;

  // Dedupe safety net — if a row already exists with the same normalized
  // name for this user, return that one instead of inserting. ILIKE makes
  // the comparison case-insensitive ('John Smith' === 'john smith'). Trim
  // collapses leading/trailing whitespace; we accept that 'John  Smith'
  // (double space) would still create a new row, which is fine for MVP.
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id)
    .ilike('name', escapeLikeWildcards(trimmed))
    .order('created_at', { ascending: true })
    .limit(1);
  if (existing && existing.length > 0) {
    return existing[0] as CustomerRow;
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: user.id,
      name: trimmed,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[customers] create failed', error.message);
    return null;
  }
  return data as CustomerRow;
}

// Escape the % and _ characters that Postgres LIKE treats as wildcards, so
// user input is matched literally inside our wrapping %s.
function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
