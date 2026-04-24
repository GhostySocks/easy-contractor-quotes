-- AI-generated quotes, one-to-many with jobs. CLAUDE.md §7.
create table quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  job_id uuid references jobs,
  customer_id uuid references customers,
  ai_generation_ms int,
  scope_of_work text,
  line_items jsonb not null default '[]',
  subtotal_cents bigint not null,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  total_low_cents bigint,
  total_high_cents bigint,
  state_notes text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index quotes_user_id_idx on quotes (user_id);
create index quotes_job_id_idx on quotes (job_id);
create index quotes_user_status_idx on quotes (user_id, status);

alter table quotes enable row level security;

create policy "quotes_select_own" on quotes
  for select using (auth.uid() = user_id);

create policy "quotes_insert_own" on quotes
  for insert with check (auth.uid() = user_id);

create policy "quotes_update_own" on quotes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "quotes_delete_own" on quotes
  for delete using (auth.uid() = user_id);
