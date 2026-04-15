-- CRM customers. PII (phone, email) is stored as text and encrypted at rest via
-- pgcrypto in a follow-up migration once the app-layer key management is finalized.
-- CLAUDE.md §3 + §7 + §9.
create table customers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state_code text,
  postal_code text,
  notes text,
  tags text[] default '{}',
  lifetime_value_cents bigint default 0,
  last_job_at timestamptz,
  created_at timestamptz default now()
);

create index customers_user_id_idx on customers (user_id);
create index customers_user_last_job_idx on customers (user_id, last_job_at desc nulls last);

alter table customers enable row level security;

create policy "customers_select_own" on customers
  for select using (auth.uid() = user_id);

create policy "customers_insert_own" on customers
  for insert with check (auth.uid() = user_id);

create policy "customers_update_own" on customers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "customers_delete_own" on customers
  for delete using (auth.uid() = user_id);
