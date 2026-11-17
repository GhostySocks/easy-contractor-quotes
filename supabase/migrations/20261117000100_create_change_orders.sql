-- Change orders: a priced, signed change to a job that already has a signed
-- agreement. CLAUDE.md §7 updated in the same change.
--
-- The agreement is never edited. Each change order is its own numbered
-- document (1, 2, 3 per job) with its own signature. Signing it moves the
-- job's total by total_cents and adds its lines to the invoice; both are done
-- by the edge functions (service role) in the same step as the signature.
--
-- line_items            [{ label, qty, unit_price_cents, total_cents }]; a
--                       negative unit price is a credit
-- subtotal / tax / total   this change only; total may be negative
-- previous_total_cents  the job total when this change order was last saved
-- new_total_cents       previous + total; what the customer signs for
-- extra_days            working days this change adds to the job
-- body_markdown         the document the customer reads and signs
-- status                draft -> sent -> signed | declined
-- signing_token         the customer's link, like contracts.signing_token
-- signature_svg ... body_sha256   the signing record, as on contracts
create table change_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  job_id uuid references jobs not null,
  customer_id uuid references customers,
  number int not null check (number > 0),
  description text not null,
  line_items jsonb not null default '[]',
  subtotal_cents bigint not null,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  previous_total_cents bigint not null,
  new_total_cents bigint not null,
  extra_days int not null default 0 check (extra_days between 0 and 365),
  body_markdown text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'declined')),
  signing_token text unique,
  signing_token_expires_at timestamptz,
  sent_at timestamptz,
  declined_at timestamptz,
  signature_svg text,
  signed_at timestamptz,
  signed_ip inet,
  signer_name text,
  signed_consent_at timestamptz,
  signed_user_agent text,
  signature_method text
    check (signature_method is null or signature_method in ('drawn', 'typed')),
  body_sha256 text check (body_sha256 is null or body_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz default now(),
  unique (job_id, number),
  -- Signed and declined are mutually exclusive, and each has its timestamp.
  check ((status = 'signed') = (signed_at is not null)),
  check ((status = 'declined') = (declined_at is not null))
);

create index change_orders_user_id_idx on change_orders (user_id);
create index change_orders_job_id_idx on change_orders (job_id);

alter table change_orders enable row level security;

-- Owners read their own. Every write goes through the change-order edge
-- function, which checks the subscription, computes the money and renders
-- the document; so clients get no insert or update policy at all. Deleting
-- is allowed only for one that was never signed.
create policy "change_orders_select_own" on change_orders
  for select using (auth.uid() = user_id);

create policy "change_orders_delete_unsigned_own" on change_orders
  for delete using (auth.uid() = user_id and signed_at is null);

-- A signed change order is write-once, like a signed contract: the customer
-- agreed to exactly this text and this price.
create or replace function change_orders_prevent_signed_update() returns trigger
  language plpgsql
as $$
begin
  if old.signed_at is not null then
    raise exception 'a signed change order cannot be changed; create a new one instead';
  end if;
  return new;
end;
$$;

create trigger change_orders_prevent_signed_update
  before update on change_orders
  for each row execute function change_orders_prevent_signed_update();
