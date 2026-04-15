-- Business profile. 1:1 with auth user. CLAUDE.md §7.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  business_name text not null,
  logo_url text,
  state_code text not null check (char_length(state_code) = 2),
  default_tax_rate numeric(5, 2) default 0,
  trade text,
  stripe_account_id text,
  onboarding_completed_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on profiles
  for delete using (auth.uid() = id);
