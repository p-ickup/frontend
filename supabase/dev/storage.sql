-- Local dev only: profile_picture storage policies, mirroring production as recorded in
-- documentation/RLS_POLICY_EVIDENCE.md. The bucket itself is declared in config.toml.
-- Public read; writes limited to the caller's own top-level folder (auth.uid()).

create policy "profile_picture public read"
  on storage.objects for select
  using (bucket_id = 'profile_picture');

create policy "profile_picture insert own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile_picture' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_picture update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile_picture' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_picture delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile_picture' and (storage.foldername(name))[1] = auth.uid()::text);
