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

/**
 * Library tab filter. 'drafts' switches the screen to render quote rows
 * (drafts that haven't become contracts/jobs yet) rather than jobs.
 */
export type LibraryStatusFilter = 'all' | 'active' | 'done' | 'drafts';

const STATUS_GROUPS: Record<Exclude<LibraryStatusFilter, 'drafts'>, JobStatus[] | null> = {
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

  // 'drafts' is handled by the Library screen via listDraftQuotes — never
  // route here. Returning empty is a defensive no-op so a stale caller can't
  // accidentally render jobs as drafts.
  if (status === 'drafts') return [];

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
 * Set or clear a job's scheduled date. Pass null to unschedule. Flips
 * 'todo' → 'scheduled' when adding a date, and 'scheduled' → 'todo' when
 * clearing one, so the Library status filter stays meaningful without the
 * caller having to remember. in_progress / completed / paid / cancelled are
 * left alone — their status isn't about scheduling.
 */
export async function setJobSchedule(
  jobId: string,
  scheduledAt: string | null,
): Promise<JobRow | null> {
  const patch: Record<string, unknown> = { scheduled_at: scheduledAt };
  if (scheduledAt) {
    patch.status = 'scheduled';
  } else {
    const { data: current } = await supabase
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .maybeSingle();
    if (current?.status === 'scheduled') patch.status = 'todo';
  }
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

/**
 * Flip a job into the in-progress state and stamp it with the current time as
 * its scheduled_at if it didn't already have one. Lets the contractor "Start"
 * a todo job without going through the schedule step first.
 */
export async function markJobInProgress(id: string): Promise<JobRow | null> {
  const { data: existing } = await supabase
    .from('jobs')
    .select('scheduled_at')
    .eq('id', id)
    .maybeSingle();

  const patch: Record<string, unknown> = { status: 'in_progress' };
  if (!existing?.scheduled_at) patch.scheduled_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[jobs] mark-in-progress failed', error.message);
    return null;
  }
  return data as JobRow;
}

/**
 * Cancel, reopen, or mark paid. Reopening returns a job to 'scheduled' if it
 * still has a date, otherwise 'todo'. Completion goes through
 * markJobCompleted (it stamps completed_at).
 */
export async function setJobStatus(
  job: Pick<JobRow, 'id' | 'scheduled_at'>,
  action: 'cancel' | 'reopen' | 'paid',
): Promise<JobRow | null> {
  const status =
    action === 'cancel'
      ? 'cancelled'
      : action === 'paid'
        ? 'paid'
        : job.scheduled_at
          ? 'scheduled'
          : 'todo';
  const { data, error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', job.id)
    .select('*')
    .single();
  if (error) {
    console.warn('[jobs] set status failed', error.message);
    return null;
  }
  return data as JobRow;
}

/** Every to-do or scheduled job with a start time still ahead, for reminders. */
export async function listUpcomingScheduledJobs(): Promise<JobWithCustomer[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(name)')
    .in('status', ['todo', 'scheduled'])
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200);
  if (error) {
    console.warn('[jobs] list upcoming failed', error.message);
    return [];
  }
  return (data ?? []).map(toJobWithCustomer);
}

/** Notes and photos are the job's own fields; RLS limits this to the owner. */
export async function updateJobDetails(
  id: string,
  patch: Partial<Pick<JobRow, 'notes' | 'photos'>>,
): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.warn('[jobs] update details failed', error.message);
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
