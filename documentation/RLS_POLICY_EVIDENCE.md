# RLS and RPC Authorization Evidence

Read-only production evidence was collected on June 12, 2026 using `RLS_POLICY_AUDIT.sql` and `RLS_POLICY_FOLLOWUP.sql`. No database objects were changed during this review.

## Browser-accessed tables

RLS was enabled on all reviewed tables:

| Table                 | Effective browser access reviewed                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Users`               | Authenticated users can read themselves, users in a shared ride, or users within their admin scope. Inserts require `user_id = auth.uid()`. |
| `Flights`             | Authenticated users can read their own flights, flights for a shared ride, or flights within their admin scope.                             |
| `Matches`             | Authenticated users can read their own matches, matches for rides they belong to, or matches within their admin scope.                      |
| `AlgorithmStatus`     | Authenticated admin read access only.                                                                                                       |
| `ChangeLog`           | Authenticated super-admin or scoped-admin read access only.                                                                                 |
| `legal_acceptances`   | Authenticated users can read and insert only their own rows.                                                                                |
| `match_cancellations` | Authenticated scoped-admin read access only.                                                                                                |

Table grants do not bypass RLS. No reviewed public-table policy grants row access to `anon`, and operations without a matching authenticated policy remain denied.

## Profile-picture storage

The `profile_picture` bucket intentionally permits public reads. Insert, update, and delete access require the object's top-level folder to equal `auth.uid()`. Insert uses `WITH CHECK`; delete uses `USING`; and the update policy's `USING` expression also applies to the resulting row because no separate `WITH CHECK` expression is defined.

## Security-definer RPCs

- `update_own_flight_tx` and `delete_own_flight_tx` require `auth.uid()`, lock and load the requested flight, and reject records not owned by the caller before mutation.
- `accept_match_request`, `cancel_own_match`, and `report_ready_status` restrict execution to authenticated/service-role callers and enforce request ownership or ride membership internally.
- ASPC delay and administrative command RPCs are restricted to `service_role` and are called only after server-side identity, membership, ownership, or admin-scope validation.
- `update_own_flight`, `delete_own_flight`, `reject_match_request`, and `report_delay` are throw-only legacy placeholders with no frontend callers.
- `restore_deleted_match` is restricted to `service_role`. Its unpinned `search_path` was recorded as a future database-hardening opportunity; it was not changed during this remediation.

The active flight transaction RPCs retain anonymous execute grants, but anonymous calls have no `auth.uid()` and are rejected before data access or mutation. No unauthorized data path was identified in the reviewed definitions and grants.
