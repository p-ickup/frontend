# Re-enabling Match Requests (Simple + Secure)

## Why match requests seem disabled

The send-request UI in `src/app/unmatched/page.tsx` is currently commented out, so users cannot open the confirmation modal that calls `sendMatchRequest(...)`.

Incoming request handling is still active in `src/app/MatchRequestsPage/page.tsx` (view, accept, reject, delete).

## Goal

Re-enable outgoing match requests with minimal code changes while keeping data access secure.

## Step 1: Re-enable the send button in UI

In `src/app/unmatched/page.tsx`, uncomment the button block near the individual traveler card (the section currently wrapped in `{/* ... */}`).

That block already:
- checks `userEligible`
- sets `selectedFlight`
- opens confirmation modal

This is the smallest change to restore existing behavior without changing the flow.

## Step 2: Add RLS for `public.MatchRequests`

Run this SQL in Supabase (SQL editor or migration):

(these policies already exist on Supabase)

```sql
alter table public."MatchRequests" enable row level security;
alter table public."MatchRequests" force row level security;

create policy "match_requests_select_participants"
on public."MatchRequests"
for select
using (
  auth.uid() = sender_id
  or auth.uid() = receiver_id
);

create policy "match_requests_insert_sender"
on public."MatchRequests"
for insert
with check (
  auth.uid() = sender_id
);

create policy "match_requests_update_receiver"
on public."MatchRequests"
for update
using (
  auth.uid() = receiver_id
)
with check (
  auth.uid() = receiver_id
);

create policy "match_requests_delete_participants"
on public."MatchRequests"
for delete
using (
  auth.uid() = sender_id
  or auth.uid() = receiver_id
);
```

## Why this policy set is low-risk

- Matches current app behavior exactly.
- Prevents users from reading or editing requests they are not part of.
- Prevents spoofed inserts with someone else as `sender_id`.
- Does not require frontend refactors.

## Step 3: Quick test checklist

Test with two normal users (A and B), plus a third user (C):

1. A sends request to B from unmatched page.
2. A can view own outgoing pending request.
3. B can view incoming request in match requests page.
4. B can accept or reject and request gets removed as expected.
5. C cannot read/update/delete A-B request.

## Optional hardening (later)

After confirming stability, tighten update logic to only allow `status` transitions to `accepted` or `rejected`.
