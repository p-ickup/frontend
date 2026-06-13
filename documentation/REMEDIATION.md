# Remediation log

## Targeted fixes for audit findings. Each section documents the problem, and what we changed.

## Item 4 — Matched flight data can become inconsistent

We implemented blocking edits/deletes of matched flights unless using a dedicated cancellation workflow.

**Two Postgres RPCs** (single transaction each, `security definer`, same pattern as `cancel_own_match`):

| RPC                                           | Behavior                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `update_own_flight_tx(p_flight_id, p_fields)` | Lock flight row → verify owner → **reject 409** if `matched = true` or any `Matches` row exists → update only whitelisted columns from `p_fields` (**never `matched`**) → delete pending `MatchRequests` involving this flight |
| `delete_own_flight_tx(p_flight_id)`           | Same auth/ownership/matched guards → delete pending `MatchRequests` → delete `Flights` row                                                                                                                                     |

**Application wiring:**

- `updateOwnFlight` / `deleteOwnFlight` in `studentCommands.ts` call the RPCs instead of direct `.from('Flights').update/delete`.
- `PATCH` / `DELETE` `/api/flights/[flightId]` use `auth.supabase` (session JWT) so `auth.uid()` works inside the RPC — service-role client would leave `auth.uid()` null and break ownership checks.
- Pre-RPC checks unchanged in TypeScript: edit deadline (`canEditFlight`), profile completeness, payload normalization.

Matched students must use the existing **`cancel_own_match`** flow (Results page) before their flight can be edited or deleted.

### Why we did not add triggers or extra constraints

- **`Matches.flight_id` already references `Flights.flight_id`** — a matched flight cannot be deleted at the database level without first removing match rows (or hitting an FK error). The RPC adds an explicit **409** with a user-facing message before that happens.
- **Triggers/constraints cannot replace business rules** such as “cancel via Results page” or service-period deadlines; they would duplicate logic already in application code and `cancel_own_match`.
- **Blocking matched mutations in the RPC** is the correct guard; constraints on `matched` column drift would be redundant with the `exists (select 1 from Matches …)` check.

### Files

| File                                                         | Change                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `supabase-migrations/2026-06-11_own_flight_mutations_tx.sql` | Both RPCs                                                    |
| `src/lib/server/studentCommands.ts`                          | RPC wrappers for update/delete                               |
| `src/app/api/flights/[flightId]/route.ts`                    | Session client for RPC auth                                  |
| `src/lib/server/studentCommands.test.ts`                     | RPC name/params, 409 mapping, no `matched` in update payload |

**TEST**

```bash
npm test -- --testPathPattern=studentCommands.test.ts
```

---

## Remediation Issue #9

**Audit item:** Page loads perform duplicate client-side authentication/profile requests, broad Supabase reads, blocking Results writes, and expensive client-side admin aggregation.

**Status:** Completed

**Summary:** The page-load architecture was changed to remove duplicate client authentication/profile waterfalls, narrow Supabase reads to explicit response contracts, and move Admin aggregation behind protected server endpoints. Results now render before readiness persistence, while Admin Groups uses a bounded date window, pagination, concurrent reads, and deferred secondary panels. A measured review of the optimized Admin Groups endpoint found no current need for a database view or RPC.

**Remediation completed:**

- **Authentication and profile state:** Added one root `AuthProvider` for user, profile, role, admin scope, school, and avatar state. Results, Unmatched, and Admin layouts hydrate that provider from a server-validated principal. The Header, pages, forms, cards, and comments reuse the shared state instead of issuing independent `getUser()` or role/profile queries. Session changes, sign-out, OAuth return paths, profile refresh, and immediate avatar updates were preserved.
- **Supabase query scope:** Replaced broad reads in the affected Results, Unmatched, profile-validation, Admin, Match Request, and comment paths with explicit field lists. Added DTO serializers for Results, Unmatched, profile completeness, Admin summary, and Admin Groups responses so undeclared fields are removed before reaching the browser. Automated coverage now rejects `select('*')` anywhere in production TypeScript and verifies exact response keys for the principal read models.
- **Results rendering:** Results data is committed to the page and loading is cleared before readiness persistence begins. Eligible ride IDs are deduplicated into one background request instead of sequential per-ride writes. The server validates membership for the full batch before updating, preserves existing readiness timestamps, and writes only rows whose `group_ready_at` remains null. Background failure does not remove rendered match data.
- **Main Admin dashboard:** Added admin-protected `GET /api/admin/dashboard-summary` and moved summary aggregation to the server. Algorithm status, schedule, and unmatched count begin concurrently; match-rate reads retain only their required dependency on the last completed run. The browser receives the nine values displayed by the dashboard. Cancellation and no-show reports remain date-bounded, user-triggered reads and do not block initial rendering.
- **Admin Groups dashboard:** Added admin-protected `GET /api/admin/groups/snapshot` for the primary matched/unmatched read model. It applies a default seven-days-back through one-month-forward window, validates a maximum 366-day range, and paginates Flights at 200 records before related hydration. The snapshot and algorithm status run concurrently, user batches run concurrently, and complete groups use a stable anchor so they appear on only one page. Changelog is loaded on expansion in 100-entry pages; pending changes load only when the Changes tab is opened. Date and page refreshes retain the current dashboard while loading.
- **Database read-model evaluation:** A reproducible 200-rider/50-group fixture produced one approximately 70.5 KiB browser response. The server performed six narrow reads including algorithm status and processed approximately 145 KiB across 801 selected rows. The bounded transfer and processing volume did not justify introducing a database view or read-only RPC. No view, RPC, index, schema, or policy change was made.

**Evidence and supporting materials:**

- `documentation/PERFORMANCE_BASELINE.md` records the original request dependencies, remediated request paths, representative payload measurements, and database read-model decision.
- `src/providers/AuthProvider.test.tsx` verifies one shared initialization, server hydration without client auth/profile reads, session changes, profile refresh, and avatar propagation.
- `src/contracts/readModels.test.ts` and `src/contracts/readModelCoverage.test.ts` verify exact response shapes and prohibit production `select('*')` queries.
- `src/app/results/page.test.tsx` and `src/lib/server/studentCommands.test.ts` verify render-before-write behavior, batching, membership validation, idempotency, and background-write failure handling.
- Admin dashboard and Admin Groups tests verify concurrent reads, bounded dates and pages, admin-scope filtering/redaction, cross-page group behavior, and deferred changelog/pending panels.

**Current verification:**

- `pnpm type-check`, `pnpm lint`, `pnpm knip`, and `pnpm knip:production` - passed with no findings.
- `pnpm exec jest --ci --runInBand` - 18 suites and 132 tests passed.
- `pnpm build` - passed; all 44 routes generated, including `/api/admin/dashboard-summary` and `/api/admin/groups/snapshot`.
- Production smoke tests confirmed Results, Unmatched, Admin, and Admin Groups reject missing sessions and preserve their complete return destinations. The Admin Groups snapshot endpoint also returned `401 Unauthorized` without a session.
- Browser payload measurements use a reproducible representative fixture because the local browser had no authenticated production dataset; no production timing or payload values were inferred.

---

## Remediation Issue #10

**Audit item:** Middleware performed Supabase session refresh work across nearly all routes without enforcing route access. Authorization was distributed across pages, API helpers, server commands, RLS policies, and RPCs, increasing the risk of missed checks.

**Status:** Completed

**Summary:** Authentication and route access are now centrally defined and consistently enforced. Middleware runs only on protected pages, validates sessions with Supabase, and redirects unauthenticated users safely. Every API handler uses an authenticated or admin wrapper, while role, admin-scope, ownership, membership, RLS, and RPC controls remain enforced at the API/database boundary.

**Remediation completed:**

- Added a central public, authenticated, and admin page policy in `src/config/routeAccess.ts`; middleware and admin pages now use the same route and authorization architecture.
- Limited middleware to protected pages and replaced `getSession()` with server-validated `getUser()`. Public pages, APIs, OAuth callbacks, and static assets no longer incur middleware session refresh work.
- Preserved internal return destinations and copied cookies from Supabase's final refreshed response during sign-in redirects. OAuth redirects use the configured production origin, and external, protocol-relative, malformed, and backslash-based return URLs are rejected.
- Consolidated API and server-rendered admin authorization in `src/lib/server/auth.ts` and removed the duplicate `adminGuard.ts` implementation.
- Added `withAuthenticatedRoute` and `withAdminRoute`; all 23 API methods across 19 route files use the required wrapper. Missing sessions return `401`; authenticated non-admin users return `403`.
- Retained role, school-based admin scope, record ownership, ride membership, RLS, and RPC checks at the API/database boundary. Service-role operations remain server-only and execute only after explicit scope or ownership validation.
- Reviewed production RLS for seven browser-accessed tables, `profile_picture` storage policies, and relevant security-definer RPCs. The reviewed policies enforce self, shared-ride, ride-member, scoped-admin, or admin access. No database policies or functions were changed.
- Added tests that scan every page and API route, preventing unclassified pages, middleware-policy drift, unwrapped API methods, or reintroduced manual guards. Negative cases cover unsafe return URLs, missing or invalid sessions, non-admin and out-of-scope admin access, cross-user flight mutations, and refreshed-cookie propagation.

**Supporting documentation:**

- `documentation/SERVICE_ROLE_AUTHORIZATION.md` maps each service-role operation to its server-derived identity, ownership, membership, or admin-scope gate.
- `documentation/RLS_POLICY_EVIDENCE.md` records the production RLS, storage-policy, grant, and RPC conclusions reviewed on June 12, 2026.
- `documentation/RLS_POLICY_AUDIT.sql` and `documentation/RLS_POLICY_FOLLOWUP.sql` provide the read-only queries used to collect that evidence.

**Test results:**

- `pnpm type-check` - passed.
- `pnpm knip` and `pnpm knip:production` - passed.
- `pnpm lint` - passed with three pre-existing React hook dependency warnings.
- `pnpm test:ci --passWithNoTests --runInBand` - 10 suites and 101 tests passed.
- `pnpm build` - passed; all 42 routes generated and middleware bundled successfully.
- Middleware tests confirmed public routes perform no Supabase session work, protected routes reject missing sessions, return destinations remain internal, and refreshed cookies survive redirects.
- Authorization tests confirmed `401` versus `403`, school-scope enforcement, user/flight ownership validation, and cross-user mutation denial before protected operations execute.
- Production smoke tests passed for all 7 public pages and 13 protected/admin route cases. Protected routes preserved their complete return destination, representative APIs rejected missing sessions with `401`, and no browser console errors occurred.

---

## Remediation Issue #12

**Audit item:**

The repository contains multiple unused or stale components, demo endpoints, commented-out feature blocks, and globally mounted providers that do not appear to be used by production app code. The TypeScript configuration does not enforce unused local/parameter checks, allowing dead code to accumulate. This is not necessarily a direct security issue, but it increases maintenance burden, bundle weight, and audit complexity. Remediation: Remove unused production code, eliminate stale components where appropriate, and configure tooling to detect unused parameters and local variables.

**Status:** Completed

**Summary:** The frontend now contains only verified production components, providers, routes, assets, and dependencies. Stale code and executable comment blocks were removed, intentionally disabled features were moved to documented decisions or a feature flag, and TypeScript, Knip, and CI now prevent unused code from accumulating.

**Remediation completed:**

- Removed 20 stale files and assets, including unused components and UI primitives, React Query infrastructure, MSW scaffolding, test utilities, an unused image helper, and an unreferenced public asset.
- Removed demo or duplicate endpoints at `/api/message`, `/api/admin/users`, and `/api/auth/callback`; `/auth/callback` remains the production OAuth callback.
- Removed unused imports, locals, parameters, props, helpers, exports, and abandoned calculations. This resolved 43 TypeScript unused-code diagnostics across 13 files.
- Removed executable code preserved in comments. Outgoing match requests are now active code behind `NEXT_PUBLIC_ENABLE_MATCH_REQUESTS`; other intentionally disabled features are recorded in `FEATURE_STATUS.md`.
- Removed eight unused direct dependency declarations: Radix dropdown/icons/slot, React Query and devtools, `class-variance-authority`, MSW, and `undici`.
- Removed the global React Query provider. Retained providers were verified as active: theme behavior is applied at the document level, flight-form tooltips use the tooltip provider, and admin group contexts have live consumers.
- Enabled `noUnusedLocals` and `noUnusedParameters` in TypeScript.
- Added `pnpm knip` and `pnpm knip:production`; both complete with zero findings.
- Added type checking, both Knip scans, linting, tests, and production build checks to pull-request CI. The build uses non-production Supabase placeholders so prerendering can validate without repository credentials or database access.

**Supporting documentation:**

- `documentation/KNIP.md` documents the Knip commands, review policy, and each narrow exception.
- `documentation/FEATURE_STATUS.md` records intentionally disabled product features and re-enable conditions.
- `documentation/ENABLE_MATCH_REQUESTS.md` documents the outgoing match-request feature flag and required security checks.
- Platform, onboarding, and operations documentation were updated to remove stale references and reflect current behavior.

**Test results:**

- `pnpm type-check` - passed with zero unused-local or unused-parameter errors.
- `pnpm knip` - passed with zero findings.
- `pnpm knip:production` - passed with zero findings.
- `pnpm lint` - passed with three existing React hook dependency warnings.
- `pnpm test -- --runInBand` - 6 suites and 37 tests passed.
- `pnpm build` - passed; 42 routes generated.
- Critical unauthenticated route smoke tests passed for authentication, profile, flight forms, results, unmatched, ASPC, and admin access guards, with no browser console errors or error boundaries.

**Repository updates:**

- `tsconfig.json`
- `package.json` and `pnpm-lock.yaml`
- `knip.json` and `knip.production.json`
- `.github/workflows/pull-request.yaml`
- `documentation/KNIP.md`
- `documentation/FEATURE_STATUS.md`
- `documentation/ENABLE_MATCH_REQUESTS.md`
- `documentation/REMEDIATION.md`
- Application pages, components, hooks, server commands, tests, middleware, and supporting documentation affected by the removed stale code
