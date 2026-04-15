-- Mirror of RevenueCat, source of truth for entitlement. CLAUDE.md §3 + §7.
-- Writes are restricted to service_role (the RevenueCat webhook). Clients can
-- read their own row to drive UI but can never insert/update/delete.
create table subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null,
  product_id text not null,
  platform text not null check (platform in ('ios', 'android', 'stripe')),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "subscriptions_select_own" on subscriptions
  for select using (auth.uid() = user_id);

-- No insert / update / delete policies: only service_role (the webhook) can mutate.
