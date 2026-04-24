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
  return (data ?? []).map((row) => ({
    ...(row as JobRow),
    customer_name: (row as { customer?: { name?: string } }).customer?.name ?? null,
  }));
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
