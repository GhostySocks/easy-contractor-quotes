-- Calendar availability blocks. CLAUDE.md §7.
create table availability (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null check (kind in ('unavailable', 'booked')),
  job_id uuid references jobs,
  created_at timestamptz default now(),
  check (ends_at > starts_at)
);

create index availability_user_id_idx on availability (user_id);
create index availability_user_range_idx on availability (user_id, starts_at, ends_at);

alter table availability enable row level security;

create policy "availability_select_own" on availability
  for select using (auth.uid() = user_id);

create policy "availability_insert_own" on availability
  for insert with check (auth.uid() = user_id);

create policy "availability_update_own" on availability
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "availability_delete_own" on availability
  for delete using (auth.uid() = user_id);
