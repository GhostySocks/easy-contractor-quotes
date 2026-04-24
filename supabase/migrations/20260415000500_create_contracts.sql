-- State-specific AI-generated contracts, e-signed. Rows become immutable
-- once signed_at is set. CLAUDE.md §3 + §7.
create table contracts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  job_id uuid references jobs,
  customer_id uuid references customers,
  kind text not null check (kind in ('work', 'release')),
  state_code text not null,
  body_markdown text not null,
  signature_svg text,
  signed_at timestamptz,
  signed_ip inet,
  version int default 1,
  created_at timestamptz default now()
);

create index contracts_user_id_idx on contracts (user_id);
create index contracts_job_id_idx on contracts (job_id);

alter table contracts enable row level security;

create policy "contracts_select_own" on contracts
  for select using (auth.uid() = user_id);

create policy "contracts_insert_own" on contracts
  for insert with check (auth.uid() = user_id);

-- Writes (updates + deletes) are only allowed while signed_at is null.
-- Once signed, the row is frozen. Amendments must be inserted as a new version.
create policy "contracts_update_unsigned_own" on contracts
  for update using (auth.uid() = user_id and signed_at is null)
  with check (auth.uid() = user_id and signed_at is null);

create policy "contracts_delete_unsigned_own" on contracts
  for delete using (auth.uid() = user_id and signed_at is null);

-- Belt-and-suspenders: a trigger that rejects any update to a signed row,
-- even if RLS is ever loosened in the future.
create or replace function contracts_prevent_signed_update() returns trigger
  language plpgsql
as $$
begin
  if old.signed_at is not null then
    raise exception 'contracts.signed_at is write-once; create a new version instead';
  end if;
  return new;
end;
$$;

create trigger contracts_prevent_signed_update
  before update on contracts
  for each row execute function contracts_prevent_signed_update();
