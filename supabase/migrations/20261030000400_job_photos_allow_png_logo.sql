-- Business logos live in the same private job-photos bucket under the owner's
-- folder ("<user_id>/logo-<id>.png") and are stored as PNG to keep
-- transparency. Same owner-only storage policies as job photos apply
-- (20261030000300_quote_form_fields.sql); nothing else changes.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'job-photos';
