-- Invoices auto-generated from quote + actuals. CLAUDE.md §7.
create table invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  job_id uuid references jobs,
  customer_id uuid references customers,
  quote_id uuid references quotes,
  line_items jsonb not null default '[]',
  subtotal_cents bigint not null,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'partial', 'paid', 'refunded')),
  stripe_payment_intent text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create index invoices_user_id_idx on invoices (user_id);
create index invoices_user_status_idx on invoices (user_id, status);
create index invoices_customer_id_idx on invoices (customer_id);

alter table invoices enable row level security;

create policy "invoices_select_own" on invoices
  for select using (auth.uid() = user_id);

create policy "invoices_insert_own" on invoices
  for insert with check (auth.uid() = user_id);

create policy "invoices_update_own" on invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoices_delete_own" on invoices
  for delete using (auth.uid() = user_id);
