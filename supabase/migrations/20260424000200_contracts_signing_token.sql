-- Per-contract signing token so a customer can open the signing page
-- without an account. Token is minted at contract creation time.
-- M1d — CN-04 customer e-sign.
alter table contracts
  add column signing_token text unique,
  add column signing_token_expires_at timestamptz;

-- Partial index: only unsigned contracts need token lookups. Once signed,
-- the token is no longer used and the row is immutable anyway.
create index contracts_signing_token_idx
  on contracts (signing_token)
  where signed_at is null;
