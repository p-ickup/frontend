begin;

alter table public."ChangeLog"
add column if not exists change_batch_id uuid;

create index if not exists idx_changelog_change_batch_id
on public."ChangeLog" (change_batch_id);

commit;
