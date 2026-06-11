# Remediation log

Targeted fixes for audit findings. Each section documents the problem, what we changed, what we intentionally deferred, and how to verify.

---

## Item 4 — Matched flight data can become inconsistent

### Audit finding

Users could update a flight through the normal owner update path without the server checking whether the flight was already matched. The update path reset `Flights.matched` to `null` while existing `Matches` rows could remain — contradictory state where a ride still exists but the flight appears pending.

The delete path checked only ownership and edit deadline, not whether the flight was part of a match, which could leave orphaned or contradictory ride state.

**Audit remediation options:**

1. Block edits/deletes of matched flights unless using a dedicated cancellation workflow.
2. If edits are allowed, make them transactional and sync `Matches`, `Rides`, `MatchRequests`, notifications, and audit records.
3. Add database constraints or triggers to prevent impossible states.

### What we did

We implemented **option 1** with a minimal transactional slice for allowed mutations.

**Two Postgres RPCs** (single transaction each, `security definer`, same pattern as `cancel_own_match`):

| RPC | Behavior |
|-----|----------|
| `update_own_flight_tx(p_flight_id, p_fields)` | Lock flight row → verify owner → **reject 409** if `matched = true` or any `Matches` row exists → update only whitelisted columns from `p_fields` (**never `matched`**) → delete pending `MatchRequests` involving this flight |
| `delete_own_flight_tx(p_flight_id)` | Same auth/ownership/matched guards → delete pending `MatchRequests` → delete `Flights` row |

**Application wiring:**

- `updateOwnFlight` / `deleteOwnFlight` in `studentCommands.ts` call the RPCs instead of direct `.from('Flights').update/delete`.
- `PATCH` / `DELETE` `/api/flights/[flightId]` use `auth.supabase` (session JWT) so `auth.uid()` works inside the RPC — service-role client would leave `auth.uid()` null and break ownership checks.
- Pre-RPC checks unchanged in TypeScript: edit deadline (`canEditFlight`), profile completeness, payload normalization.

Matched students must use the existing **`cancel_own_match`** flow (Results page) before their flight can be edited or deleted.

### Why we did not implement the audit’s full sync path

We **do not allow edits or deletes while matched**. The audit’s full transactional sync (`Matches`, `Rides`, notifications, audit log) applies only if matched edits were permitted. We block those operations and route unmatched users through `cancel_own_match` instead.

For **allowed** edits/deletes (unmatched flights), transactional scope is limited to what can actually go stale: the flight row and pending `MatchRequests`. We do not touch `Matches` or `Rides` because those rows should not exist for the flight being mutated.

### Why we did not add triggers or extra constraints

- **`Matches.flight_id` already references `Flights.flight_id`** — a matched flight cannot be deleted at the database level without first removing match rows (or hitting an FK error). The RPC adds an explicit **409** with a user-facing message before that happens.
- **Triggers/constraints cannot replace business rules** such as “cancel via Results page” or service-period deadlines; they would duplicate logic already in application code and `cancel_own_match`.
- **Blocking matched mutations in the RPC** is the correct guard; constraints on `matched` column drift would be redundant with the `exists (select 1 from Matches …)` check.

### Files

| File | Change |
|------|--------|
| `supabase-migrations/2026-06-11_own_flight_mutations_tx.sql` | Both RPCs |
| `src/lib/server/studentCommands.ts` | RPC wrappers for update/delete |
| `src/app/api/flights/[flightId]/route.ts` | Session client for RPC auth |
| `src/lib/server/studentCommands.test.ts` | RPC name/params, 409 mapping, no `matched` in update payload |

### Verify

**Automated:**

```bash
npm test -- --testPathPattern=studentCommands.test.ts
```

**Manual (localhost):**

1. Edit and delete an **unmatched** flight (`matched IS NULL`) on `/questionnaires` — should succeed; `Flights` row gone on delete; pending `MatchRequests` for that flight cleared on edit/delete.
2. Attempt edit/delete on a **matched** flight (or via API) — **409** with message to cancel from Results first.
3. Confirm `matched` is **not** reset to `null` after a successful edit.

**SQL (optional):**

```sql
-- After delete
select * from "Flights" where flight_id = <id>;  -- 0 rows

-- Matched guard
select * from "Matches" where flight_id = <id>;  -- if rows exist, delete/update RPC returns 409
```

### Deferred / residual risk

| Item | Notes |
|------|-------|
| Allowing edits while matched + syncing `Matches` / `Rides` / vouchers | Out of scope; use `cancel_own_match` |
| `Feedback`, `ChangeLog`, notification cleanup on delete | Add to RPC only if FK errors appear in production |
| Admin flight update paths (`updateFlightRecord`, etc.) | Separate audit item |
| Edit deadline enforcement | Remains in TypeScript (`canEditFlight`), not in RPC |
| DB triggers / status enum | Not required given block-on-matched policy |

### Auditor summary

> We applied minimal targeted fixes: student flight update/delete now run in transactional RPCs that block operations when the flight is matched or referenced in `Matches`; updates no longer reset `matched` to null; pending `MatchRequests` are cleaned up atomically with allowed mutations. Full multi-table sync on matched edits was not implemented because matched edits are blocked; students cancel via `cancel_own_match` instead. Broader items (explicit status model, admin paths, notification/audit cleanup) are deferred above.
