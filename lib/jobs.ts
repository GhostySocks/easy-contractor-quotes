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
 * Jobs tab.
 *
 * Search matches case-insensitive substrings against either the job title or
 * the joined customer name. PostgREST can't express "title OR embedded.name"
 * in a single query while still returning parent rows when only the title
 * hits, so we resolve customer matches in a small first pass and OR the
 * resulting customer_id set into the jobs filter.
 */
export async function listAllJobs(opts?: {
  status?: LibraryStatusFilter;
  search?: string;
  limit?: number;
}): Promise<JobWithCustomer[]> {
  const status = opts?.status ?? 'all';
  const search = opts?.search?.trim() ?? '';
  const limit = opts?.limit ?? 200;

  // Pre-resolve customers whose name matches the search, so we can OR them
  // into the jobs filter. Capped at 200 since a real contractor isn't going
  // to type a query that legitimately matches more.
  let customerIds: string[] = [];
  if (search) {
    const { data: matched, error: customerErr } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${escapeLikeWildcards(search)}%`)
      .limit(200);
    if (customerErr) {
      console.warn('[jobs] customer pre-search failed', customerErr.message);
    } else {
      customerIds = (matched ?? []).map((c: { id: string }) => c.id);
    }
  }

  let query = supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const statuses = STATUS_GROUPS[status];
  if (statuses) query = query.in('status', statuses);

  if (search) {
    const escaped = escapeLikeWildcards(search);
    if (customerIds.length > 0) {
      query = query.or(`title.ilike.%${escaped}%,customer_id.in.(${customerIds.join(',')})`);
    } else {
      query = query.ilike('title', `%${escaped}%`);
    }
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

/**
 * Jobs scheduled inside a date range (inclusive on both ends, ISO datetime
 * strings). Used by the Calendar tab to mark dots and render the day list.
 * Returns rows ordered earliest-to-latest within the window.
 */
export async function listJobsByDateRange(
  fromIso: string,
  toIso: string,
  limit = 500,
): Promise<JobWithCustomer[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[jobs] list-by-range failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

/**
 * All jobs for one customer, newest first. Used by the Customer profile
 * screen's "Jobs with this customer" section. No status filter — we want the
 * full history, including completed and cancelled jobs.
 */
export async function listJobsForCustomer(
  customerId: string,
  limit = 50,
): Promise<JobWithCustomer[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .eq('customer_id', customerId)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[jobs] list-for-customer failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

/**
 * Jobs with no scheduled_at yet. Used by the Calendar "schedule a job for
 * this day" picker. Capped because solo contractors rarely have more than a
 * handful of unscheduled jobs sitting around.
 */
export async function listUnscheduledJobs(limit = 50): Promise<JobWithCustomer[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .is('scheduled_at', null)
    .not('status', 'in', '(completed,paid,cancelled)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[jobs] list-unscheduled failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

/**
 * Set or clear a job's scheduled date. Pass null to unschedule. Also flips
 * 'todo' jobs to 'scheduled' when we're putting a date on them — so the
 * status filter on the Library stays meaningful without the caller having
 * to remember.
 */
export async function setJobSchedule(
  jobId: string,
  scheduledAt: string | null,
): Promise<JobRow | null> {
  const patch: Record<string, unknown> = { scheduled_at: scheduledAt };
  if (scheduledAt) patch.status = 'scheduled';
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) {
    console.warn('[jobs] set-schedule failed', error.message);
    return null;
  }
  return data as JobRow;
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
