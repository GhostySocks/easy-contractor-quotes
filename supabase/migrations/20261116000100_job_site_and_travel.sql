-- Job site, business address and travel. CLAUDE.md §7 updated in the same change.
--
-- Three places can differ: where the business is based, where the customer
-- lives (customers.address_*), and where the work happens. The job site is
-- what prices the quote and decides which state's contract terms apply.
--
-- Additive only. These tables already have RLS restricting every read and
-- write to auth.uid() = user_id (profiles: id), which covers the new columns.

-- Where the contractor starts from, for the travel distance on a quote.
-- base_lat / base_lng are looked up on the phone when the address is saved.
alter table profiles
  add column address_line1 text,
  add column city text,
  add column postal_code text,
  add column base_lat double precision,
  add column base_lng double precision;

-- Where the work happens, and the travel charge the contractor chose.
-- travel: { mode: 'flat' | 'per_mile', rate_cents, per: 'job' | 'day', days,
--           miles_one_way } or null when travel isn't charged
--           (supabase/functions/_shared/travel.ts).
alter table quotes
  add column site_address_line1 text,
  add column site_city text,
  add column site_state_code text
    check (site_state_code is null or char_length(site_state_code) = 2),
  add column site_postal_code text,
  add column travel jsonb;

-- Copied from the quote when its contract is signed, so the job knows where to go.
alter table jobs
  add column site_address_line1 text,
  add column site_city text,
  add column site_state_code text
    check (site_state_code is null or char_length(site_state_code) = 2),
  add column site_postal_code text;
