-- Fix: the write-once trigger on contracts rejected the one update that must
-- happen after signing — post-sign linking the freshly created job via job_id.
-- A customer-signed contract therefore never pointed at its job, job detail
-- could not find the quote, and "Mark completed" (and so invoicing) failed.
--
-- The row stays immutable except for exactly this transition: job_id going
-- from null to a value with every other column unchanged. RLS is untouched
-- (clients still cannot update signed rows); only the service-role path used
-- by the edge functions reaches this trigger with a signed row.
create or replace function contracts_prevent_signed_update() returns trigger
  language plpgsql
as $$
declare
  candidate contracts;
begin
  if old.signed_at is not null then
    if old.job_id is null and new.job_id is not null then
      candidate := new;
      candidate.job_id := old.job_id;
      if candidate is not distinct from old then
        return new;
      end if;
    end if;
    raise exception 'contracts.signed_at is write-once; create a new version instead';
  end if;
  return new;
end;
$$;
