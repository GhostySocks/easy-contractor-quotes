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
  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
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
