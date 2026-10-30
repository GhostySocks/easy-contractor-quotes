-- Travel time kept clear before and after every job when scheduling
-- (PRD CL-04: configurable 15/30/60 min; 0 = off). Used to warn about jobs
-- booked too close together. CLAUDE.md §7 updated in the same change.
-- profiles already has RLS (owner-only); this only adds a column.
alter table profiles
  add column travel_buffer_minutes int not null default 30
    check (travel_buffer_minutes in (0, 15, 30, 60));
