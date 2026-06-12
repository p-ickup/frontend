# Codebase onboarding

Quick path from clone to a safe first change.

## Prerequisites

- Node 20+, **pnpm** 9.15+ (`corepack use pnpm@9.15.2`)
- Supabase project access (URL, anon key, service role secret)
- Google OAuth configured in Supabase (for local sign-in)
- Netlify access if you need to check production env vars or deploy settings

## Local setup

```bash
pnpm install
```

Create `.env.local` (minimum):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SECRET_KEY=<service-role-key>   # server only; never expose
```

Optional:

```bash
NEXT_PUBLIC_AUTH_CALLBACK_URL=http://localhost:3000/auth/callback
```

```bash
pnpm dev    # http://localhost:3000
```

Useful scripts: `pnpm type-check`, `pnpm test`, `pnpm lint`.

## Repo layout

```
src/
  app/                    # Next.js App Router: pages + API routes
    api/                  # Server routes (preferred for mutations)
    admin/                # Admin UI
    questionnaires/       # Flight intake
    results/              # Matched rides
    unmatched/            # Find partners
  components/             # React UI (admin/, forms/, results/, …)
  hooks/                  # Client hooks (useAuth, …)
  lib/server/             # Server-only business logic ★ start here for API behavior
  utils/                  # Shared helpers (supabase client, validation)
  config/                 # e.g. subsidyConfig.ts
supabase-migrations/      # SQL for RPCs this app calls (apply in Supabase)
documentation/            # You are here
```

**Rule of thumb:** Client components call **`/api/...`** or Supabase with the **anon** client. Multi-step or cross-table writes go through **`src/lib/server/*`** and often **service role** + **RPC**.

## Auth and sessions

- **`src/utils/supabase.ts`** — Browser, server, and middleware Supabase clients (`@supabase/ssr`).
- **`src/middleware.ts`** — Refreshes session on each request.
- **`src/hooks/useAuth.ts`** — Google sign-in, session state, profile avatar.
- **`src/app/auth/callback/route.ts`** — OAuth callback; ensures `Users` row exists.

Server routes use `requireAuthenticatedRoute()` or `requireAdminRoute()` which read the session cookie and load `Users.role` for admins.

## Where to implement common tasks

| Task                     | Where to look                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| New student-facing API   | `src/app/api/<name>/route.ts` + `src/lib/server/studentCommands.ts`                         |
| New admin mutation       | `src/app/api/admin/groups/command/route.ts` switch + `adminGroupsCommands.ts`               |
| Admin UI for groups      | `src/components/admin/groups-management/` (newer) and `GroupsManagement.tsx` (legacy paths) |
| Flight form / validation | `src/components/forms/FlightForm.tsx`, `src/utils/flightValidation.ts`                      |
| Subsidy rules            | `src/config/subsidyConfig.ts`, `src/hooks/useSubsidyLogic.ts`                               |
| Admin scope enforcement  | `src/lib/server/adminScope.ts`                                                              |
| Batch emails from UI     | `src/components/admin/AdminDashboard.tsx` → `/api/admin/send-*-emails`                      |
| Database schema          | `src/lib/database.types.ts`                                                                 |

## Admin groups command API

`POST /api/admin/groups/command` body:

```json
{ "action": "<snake_case>", "payload": {} }
```

Actions implemented today:

- `log_change_log_entry`
- `update_group_time`, `update_group_voucher`
- `update_flight_record`
- `remove_group_match`, `delete_rider_matches`
- `upsert_manual_group_match`, `update_group_matches_metadata`
- `mark_flights_matched_state`
- `delete_group_records`, `create_group_records`
- `save_group_override_records`, `confirm_change_log_entries`
- `add_unmatched_flight`

`create_group_records` / `delete_group_records` call Postgres RPCs (transactional). Most other actions use service-role Supabase queries in `adminGroupsCommands.ts`.

## Testing

- Jest + Testing Library; tests colocated (`*.test.ts`, `*.test.tsx`).
- Admin/groups flows: `GroupsManagement.test.tsx`, `studentCommands.test.ts`.

Run: `pnpm test`.

## Migrations in this repo

Files in `supabase-migrations/` are **not auto-applied** by Next.js. Apply via Supabase SQL editor or your migration pipeline. They define RPCs the app expects; if production is missing one, RPC calls will fail at runtime.

When changing an RPC, add a new dated SQL file here and apply it to the linked Supabase project.

## Pitfalls (read before your first PR)

1. **Service role** bypasses RLS — only use in API routes after auth + admin scope (or tightly validated student flows).
2. **Do not** import `src/lib/server/*` from client components (`server-only`).
3. **Outgoing match requests** are disabled by default through `NEXT_PUBLIC_ENABLE_MATCH_REQUESTS`; see [ENABLE_MATCH_REQUESTS.md](./ENABLE_MATCH_REQUESTS.md).
4. **Edge functions for emails** — Admin triggers batch send; implementation is in Supabase edge functions, not this repo (see [SUPABASE.md](./SUPABASE.md)).
5. **PascalCase table names** — e.g. `Users`, `Flights`, `Matches`; match exactly in queries.
6. **Time zones** — Admin groups UI uses PST helpers (`groups-management/utils/datePst.ts`); be consistent when editing dates/times.

## Related docs

- [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) — product and architecture
- [SCHEMA.md](./SCHEMA.md) — database tables and columns
- [SUPABASE.md](./SUPABASE.md) — RPC and edge function catalog
- [OPERATIONS.md](./OPERATIONS.md) — break prep, types sync, emails, delay cron
- [BATCH_EMAIL_LOGIC.md](./BATCH_EMAIL_LOGIC.md) — email content rules
