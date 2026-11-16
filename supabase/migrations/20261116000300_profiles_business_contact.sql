-- How customers reach the business. CLAUDE.md §7 updated in the same change.
--
-- business_phone  shown in the footer of quote, signed-agreement and invoice emails
-- business_email  shown there too, and where a customer's reply goes. When it
--                 is blank, replies go to the contractor's login email.
--
-- These are the contractor's own public contact details, not customer PII.
-- Additive only. profiles already has RLS restricting every read and write
-- to the owner (auth.uid() = id), which covers the new columns.
alter table profiles
  add column business_phone text,
  add column business_email text;
