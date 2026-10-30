-- customers.lifetime_value_cents and customers.last_job_at were only ever
-- written by the dev seed script, so real customers always showed $0 / "—".
-- Roll them up from jobs in the database so every path (app, edge
-- functions, seed) keeps them current.
--
-- lifetime_value_cents = sum of total_cents over completed + paid jobs.
-- last_job_at          = latest completed_at (or scheduled_at) over those jobs.
create or replace function customers_rollup_from_jobs(target_customer uuid) returns void
  language sql
as $$
  update customers c
  set
    lifetime_value_cents = coalesce(
      (select sum(j.total_cents) from jobs j
        where j.customer_id = target_customer and j.status in ('completed', 'paid')),
      0
    ),
    last_job_at = (
      select max(coalesce(j.completed_at, j.scheduled_at, j.created_at)) from jobs j
        where j.customer_id = target_customer and j.status in ('completed', 'paid')
    )
  where c.id = target_customer;
$$;

create or replace function jobs_rollup_customer() returns trigger
  language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.customer_id is not null then perform customers_rollup_from_jobs(old.customer_id); end if;
    return old;
  end if;
  if new.customer_id is not null then perform customers_rollup_from_jobs(new.customer_id); end if;
  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id and old.customer_id is not null then
    perform customers_rollup_from_jobs(old.customer_id);
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_rollup_customer on jobs;
create trigger jobs_rollup_customer
  after insert or update of status, total_cents, completed_at, customer_id or delete on jobs
  for each row execute function jobs_rollup_customer();

-- Backfill existing rows once.
select customers_rollup_from_jobs(id) from customers;
