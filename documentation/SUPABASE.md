# Supabase: database functions, edge functions, and syncing

This app treats Supabase as **Auth + Postgres + Edge Functions**. The frontend repo does **not** currently contain a full `supabase/` project (no `config.toml`, no edge function sources). It **does** contain SQL migrations for RPCs the Next.js app calls.

For table and column definitions, see [SCHEMA.md](./SCHEMA.md). Machine-readable types: [`src/lib/database.types.ts`](../src/lib/database.types.ts). To regenerate types, send batch emails, or enable delay cron, see [OPERATIONS.md](./OPERATIONS.md).

## Edge functions (invoked from this repo)

These are called by HTTP from admin API routes (anon key in `Authorization` header):

| Function | Called from | Purpose |
|----------|-------------|---------|
| `send-all-match-emails-batch` | `src/app/api/admin/send-match-emails/route.ts` | Batch Resend emails for verified matches with `email_sent = false` |
| `send-unmatched-emails-batch` | `src/app/api/admin/send-unmatched-emails/route.ts` | Batch emails for unmatched riders |

URL shape: `{NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<name>`

Email **content rules** (variants: subsidized × direction) are described in [BATCH_EMAIL_LOGIC.md](./BATCH_EMAIL_LOGIC.md). Implementation is in the edge function codebase (not in this frontend tree).

Other **edge functions** and **database functions** may exist in Supabase project (cron, webhooks, etc.) but are **not referenced** in this frontend repo.

## Postgres RPCs used by the app

Defined in `supabase-migrations/` (and must exist in production).

### Student / authenticated (`grant` to `authenticated`)

| RPC | Called from | Purpose |
|-----|-------------|---------|
| `accept_match_request(p_request_id uuid)` | `studentCommands.acceptMatchRequest` | Atomically accept request and form/join group |
| `cancel_own_match(p_ride_id bigint)` | `studentCommands.cancelOwnMatch` | User leaves a ride group |
| `report_ready_status(p_ride_id, p_status, p_user_ids)` | `studentCommands` (ASPC ready) | Record group readiness |

### Service role only (`revoke` from `authenticated`; API uses `SUPABASE_SECRET_KEY`)

| RPC | Called from | Purpose |
|-----|-------------|---------|
| `create_group_records(...)` | `adminGroupsCommands.createGroupRecords` | Create ride + matches + flight links |
| `delete_group_records(...)` | `adminGroupsCommands.deleteGroupRecords` | Delete/disband group |
| `aspc_delay_keep_original_group` | `aspcDelayCommands` | Delay flow: stay in group |
| `aspc_delay_move_to_unmatched` | `aspcDelayCommands` | Delay flow: return to unmatched |
| `aspc_delay_create_solo_ride` | `aspcDelayCommands` | Delay flow: solo ride |
| `aspc_delay_join_group` | `aspcDelayCommands` | Delay flow: join another group |
| `aspc_delay_decline_groups` | `aspcDelayCommands` | Delay flow: decline options |

Internal helper (not called from TypeScript directly):

- `insert_aspc_delay_change_log` — used inside delay RPCs; execute revoked for clients.

### Direct table access (no RPC)

Examples: `sendMatchRequest` / `rejectMatchRequest` use `MatchRequests` + `Flights` via Supabase client (RLS must allow). Many admin reads/writes in `groupsReadService` / `adminGroupsCommands` use service role on `Matches`, `Flights`, `ChangeLog`, etc.

## Security model (short)

- **RLS** on tables for normal users where policies are enabled (e.g. `MatchRequests` — see [ENABLE_MATCH_REQUESTS.md](./ENABLE_MATCH_REQUESTS.md)).
- **RPCs** return `jsonb` with `{ success, error?, status? }`; TypeScript checks `success === true`.
- **Dangerous RPCs** are `security definer` with `EXECUTE` granted only to `service_role` (or `authenticated` where noted in migration files).
- **Next.js API routes** are the gate: verify user/admin, then call RPC with appropriate client.

## Syncing functions into the repo (optional)

The project already has the Supabase CLI as a devDependency (`supabase` in `package.json`).

### One-time: link project

From repo root:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <your-project-ref>
pnpm exec supabase init   # if you want supabase/ folder created here
```

### Pull edge function sources

```bash
pnpm exec supabase functions download send-all-match-emails-batch
pnpm exec supabase functions download send-unmatched-emails-batch
# or download all deployed functions per CLI docs
```

Commit `supabase/functions/<name>/index.ts` (and shared deps). Deploy with `supabase functions deploy <name>`.

### Pull / track database schema and RPCs

Prefer **migrations as source of truth** (keep adding files under `supabase-migrations/` or move to `supabase/migrations/`):

```bash
# Diff remote schema (requires link)
pnpm exec supabase db diff -f new_change_description

# Or dump remote schema for reference (read-only snapshot)
pnpm exec supabase db dump --schema public > documentation/schema-snapshot.sql
```

Avoid committing a huge snapshot unless the team wants it; **dated migration files** are easier to review.

### What to skip

- Pulling **every** legacy DB function from an old Supabase project if nothing in this app calls it — document orphans in Supabase dashboard instead.
- Duplicating edge functions **and** long SQL in docs — pick git + short catalog (this file).

## Applying migrations from this repo

1. Open Supabase SQL editor (or CI migration step).
2. Run new files in `supabase-migrations/` in chronological order.
3. Confirm grants (`grant execute` / `revoke`) match each file’s footer.

If production already has equivalent definitions, diff before applying to avoid overwriting hotfixes made only in the dashboard.

## Environment variables (Supabase-related)

| Variable | Exposure | Use |
|----------|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client + server session; edge invoke from admin routes |
| `SUPABASE_SECRET_KEY` | **Server only** | Service role client for admin commands and selected student APIs |

Never prefix the service role key with `NEXT_PUBLIC_`.
