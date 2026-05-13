import { supabase } from './supabase';

export type JobStatus = 'todo' | 'scheduled' | 'in_progress' | 'completed' | 'paid' | 'cancelled';

export type JobRow = {
  id: string;
  user_id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  total_cents: number | null;
  notes: string | null;
  photos: string[];
  created_at: string;
};

export type JobWithCustomer = JobRow & {
  customer_name: string | null;
};

export async function fetchJob(id: string): Promise<JobRow | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[jobs] fetch failed', error.message);
    return null;
  }
  return (data as JobRow) ?? null;
}

export async function listActiveJobs(limit = 8): Promise<JobWithCustomer[]> {
  // "Active" = anything the contractor still has work to do on. Completed
  // and paid jobs drop out. `todo` and `scheduled` also count since we
  // haven't shipped the scheduling UI yet.
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .in('status', ['todo', 'scheduled', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[jobs] list failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

export type LibraryStatusFilter = 'all' | 'active' | 'done';

const STATUS_GROUPS: Record<LibraryStatusFilter, JobStatus[] | null> = {
  all: null,
  active: ['todo', 'scheduled', 'in_progress'],
  done: ['completed', 'paid'],
};

/**
 * Full Library list — every job the user owns, newest first. Used by the
 * Jobs tab. Search is a case-insensitive prefix-anywhere match on the job
 * title; for matching by customer name we'd need a Postgres `or` across the
 * joined table, which we can layer in once volume warrants it.
 */
export async function listAllJobs(opts?: {
  status?: LibraryStatusFilter;
  search?: string;
  limit?: number;
}): Promise<JobWithCustomer[]> {
  const status = opts?.status ?? 'all';
  const search = opts?.search?.trim() ?? '';
  const limit = opts?.limit ?? 200;

  let query = supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const statuses = STATUS_GROUPS[status];
  if (statuses) query = query.in('status', statuses);

  if (search) {
    query = query.ilike('title', `%${escapeLikeWildcards(search)}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[jobs] listAll failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

function toJobWithCustomer(row: unknown): JobWithCustomer {
  const r = row as JobRow & { customer?: { name?: string } };
  return { ...r, customer_name: r.customer?.name ?? null };
}

function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function markJobCompleted(id: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[jobs] mark-completed failed', error.message);
    return null;
  }
  return data as JobRow;
}
