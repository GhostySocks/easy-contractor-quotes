-- New Quote form: job type, requested start date, and job photos.
-- CLAUDE.md §7 updated in the same change.
--
-- job_type            trade picked for this quote (defaults to the profile trade
--                     in the app); drives pricing context.
-- requested_start_at  when the customer wants the work done. When the quote's
--                     contract is signed, the job is created already scheduled
--                     for this time (see _shared/job-from-quote.ts).
-- photos              storage paths in the private job-photos bucket,
--                     "<user_id>/<file>.jpg". At most 4 per quote.
alter table quotes
  add column job_type text,
  add column requested_start_at timestamptz,
  add column photos text[] not null default '{}';

alter table quotes
  add constraint quotes_photos_max_4 check (cardinality(photos) <= 4);

-- Private bucket for job photos. Files are resized to ~1024 px JPEG on the
-- phone before upload, so 2 MB is a generous ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Each user may only touch objects under their own "<user_id>/" folder.
-- No update policy: a photo is replaced by deleting and re-uploading.
create policy "job_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);
