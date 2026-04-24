-- Link contracts back to the quote that produced them. M1c.
-- Nullable because legacy rows exist in test environments without a source quote.
alter table contracts
  add column quote_id uuid references quotes;

create index contracts_quote_id_idx on contracts (quote_id);
