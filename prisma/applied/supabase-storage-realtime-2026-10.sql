-- Supabase Storage + Realtime for MentorsMD (Oct 2026). Replaces Vercel Blob and Pusher.
--
-- ALREADY APPLIED to the MentorsMD Supabase project (ref oviasvsvtlrgmrgtbrvn) on Oct 14, 2026
-- as the migration "mentorsmd_storage_buckets_and_realtime_auth". Kept here for reference; running
-- it again is safe for the buckets (on conflict) but the policy would need dropping first.
-- It does not touch any of the app's own tables.

-- Two buckets. Uploads only ever happen through one-time upload links created by the server
-- (service role, lib/storage.ts), so there are deliberately NO insert/update/delete/select
-- policies on storage.objects for anon or authenticated: browsers can't list, read or write
-- anything directly. Private files are read through short-lived signed links from our routes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('private-files', 'private-files', false, 10485760, null),   -- 10MB: attachments, deliveries, résumés
  ('public-media', 'public-media', true, 8388608,              -- 8MB: profile photos, website photos
     array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Realtime: a signed-in person (one-hour pass from /api/realtime/token, sub = MentorsMD user id,
-- role = authenticated) may only RECEIVE broadcasts on their own private topic:
-- "live:user:<id>" (production) or "preview:user:<id>" (preview deployments).
-- No insert policy: browsers can never broadcast. The server broadcasts with the service role key.
create policy "mmd: receive own user topic"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) in (
    'live:user:' || ((select auth.jwt()) ->> 'sub'),
    'preview:user:' || ((select auth.jwt()) ->> 'sub')
  )
);
