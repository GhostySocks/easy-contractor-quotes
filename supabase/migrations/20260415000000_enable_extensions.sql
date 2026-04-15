-- Enable required Postgres extensions.
-- pgcrypto is used to encrypt customers.phone and customers.email at rest (CLAUDE.md §3).
-- gen_random_uuid() comes from pgcrypto on modern Postgres.
create extension if not exists pgcrypto;
