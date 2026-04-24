-- Jobs — the central entity. CLAUDE.md §7.
create table jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  customer_id uuid references customers,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'scheduled', 'in_progress', 'completed', 'paid', 'cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  total_cents bigint,
  notes text,
  photos text[] default '{}',
  created_at timestamptz default now()
);

create index jobs_user_id_idx on jobs (user_id);
create index jobs_user_status_idx on jobs (user_id, status);
create index jobs_user_scheduled_idx on jobs (user_id, scheduled_at);

alter table jobs enable row level security;

create policy "jobs_select_own" on jobs
  for select using (auth.uid() = user_id);

create policy "jobs_insert_own" on jobs
  for insert with check (auth.uid() = user_id);

create policy "jobs_update_own" on jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "jobs_delete_own" on jobs
  for delete using (auth.uid() = user_id);
