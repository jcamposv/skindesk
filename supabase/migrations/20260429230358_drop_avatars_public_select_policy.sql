-- Public buckets serve files via the unauthenticated `/object/public/<bucket>/...`
-- URL without going through RLS, so a SELECT policy on storage.objects is
-- unnecessary AND lets anon clients enumerate the bucket via `.list()`. Drop it
-- (advisor lint `public_bucket_allows_listing`). Owners can still INSERT /
-- UPDATE / DELETE under their own folder thanks to the existing policies.
drop policy if exists "avatars_public_read" on storage.objects;
