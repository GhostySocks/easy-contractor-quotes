-- A fuller record of each signature. CLAUDE.md §7 updated in the same change.
--
-- An e-signature holds up on evidence. signature_svg, signed_at and signed_ip
-- were already kept; these add who typed their name, that they agreed to sign
-- electronically, what device they used, and a fingerprint of the exact text.
--
-- signer_name        full name typed on the signing page
-- signed_consent_at  when they ticked "I agree to sign electronically"
-- signed_user_agent  browser / device string of the signer
-- signature_method   'drawn' (finger or mouse) or 'typed' (their typed name)
-- body_sha256        SHA-256 (hex) of body_markdown at the moment of signing
--
-- All five are written in the same update that sets signed_at, by the edge
-- functions (service role). After that the existing write-once trigger
-- (contracts_prevent_signed_update) freezes them with the rest of the row.
--
-- Additive only. RLS is unchanged: owners read their own rows, and clients
-- still cannot update a signed row.
alter table contracts
  add column signer_name text,
  add column signed_consent_at timestamptz,
  add column signed_user_agent text,
  add column signature_method text
    check (signature_method is null or signature_method in ('drawn', 'typed')),
  add column body_sha256 text
    check (body_sha256 is null or body_sha256 ~ '^[0-9a-f]{64}$');
