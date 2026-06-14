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

## Item 5 — `Flights.matched` → `matching_status` cutover

**Audit item:** Flight lifecycle was encoded in a legacy boolean `Flights.matched` (`null` / `false` / `true`) while newer code and `commit_matching_run` already wrote `matching_status`. Dual columns drifted and made filters ambiguous (e.g. student unmatched pool vs admin “unmatched forms” count).

**Status:** Completed

**Summary:** Replaced boolean semantics with a single enum-like text column: `submitted` | `unmatched` | `matched`. Eight Postgres RPCs were rewritten; the frontend and admin tools read/write the new column `matching_status` only. Canonical helpers in [`matchingStatus.ts`](src/utils/matchingStatus.ts) centralize status checks. Edge functions required no redeploy for this column.

### Status semantics

| `matching_status` | Replaces `matched` | Meaning |
| ----------------- | ------------------ | ------- |
| `submitted` | `null` | Filed; awaiting batch matcher |
| `unmatched` | `false` | Post-matcher; no group |
| `matched` | `true` | In a group (`Matches` row exists) |

**Filter rules (unchanged product behavior, new column):**

| Surface | Filter |
| ------- | ------ |
| Student `/unmatched` coordination pool | `unmatched` only |
| `/questionnaires` Upcoming | `submitted` |
| `/questionnaires` Unmatched section | `unmatched` |
| Admin dashboard unmatched count + CSV | `submitted` + `unmatched` |
| Admin groups unmatched riders panel | `matching_status <> 'matched'` |

### Database

`CREATE OR REPLACE` on eight RPCs that read or wrote `matched`:

| RPC | Change |
| --- | ------ |
| `accept_match_request` | Guards and sets `matching_status = 'matched'` |
| `cancel_own_match` | Sets `matching_status = 'unmatched'` |
| `create_group_records` | Sets `matching_status = 'matched'` for group riders |
| `delete_group_records` | Optional `matching_status = 'unmatched'` |
| `aspc_delay_move_to_unmatched` | Sets `matching_status = 'unmatched'` |
| `aspc_delay_decline_groups` | Sets `matching_status = 'unmatched'` |
| `update_own_flight_tx` | 409 guard uses `matching_status = 'matched'` (with Item 4) |
| `delete_own_flight_tx` | Same read guard |

### Deferred (Phase 4) - STILL TODO

- `p_cancelled_after_deadline` on `cancel_own_match` + TS pre-fetch in `cancelOwnMatch` (today RPC still hardcodes `cancelled_after_deadline = true`).
- `DROP COLUMN matched` after soak.

### Files

| File | Change |
| ---- | ------ |
| `supabase-migrations/2026-06-11_matching_status_cutover.sql` | RPC cutover |
| `src/utils/matchingStatus.ts` | Canonical status helpers |
| `src/utils/matchingStatus.test.ts` | Helper tests |
| `src/lib/server/studentCommands.ts` | Reads/writes `matching_status`; FK-qualified embeds |
| `src/lib/server/adminGroupsCommands.ts` | `matching_status` updates |
| `src/lib/server/aspcDelayCommands.ts` | FK-qualified embeds |
| `src/app/questionnaires/page.tsx` | Status-based sections |
| `src/components/forms/FlightForm.tsx` | `matching_status` on load |
| `src/components/admin/AdminDashboard.tsx` | Dashboard count filter |
| `src/components/admin/GroupsManagement.tsx` | Admin mark-matched API |
| `src/app/api/admin/groups/command/route.ts` | `matchingStatus` in payload |
| `src/lib/server/studentCommands.test.ts` | RPC/status mocks updated |
| `src/lib/server/adminGroupsCommands.test.ts` | Update payload tests |

**Tests**

```bash
pnpm test -- src/utils/matchingStatus.test.ts src/lib/server/studentCommands.test.ts src/lib/server/adminGroupsCommands.test.ts
```

---

## Item 7 — Canonical `servicePeriods` config

**Audit item:** Subsidized dates, buffered windows, deadlines, and trip-direction rules were split across `subsidyConfig.ts`, `flightValidation.ts` `SERVICE_PERIODS`, and inline `FlightForm` `operationalPeriods`.

**Status:** Completed (frontend)

**Summary:** One coder-edited config in `src/config/servicePeriods.ts` drives subsidy lists, deadline enforcement, flight-form direction gating, and the ASPC policy page. Pure helpers in `servicePeriodHelpers.ts` are covered by golden tests. The flight form wizard was **reordered** so students pick **ride date first**; **To Airport / To Campus** buttons on step 2 are enabled or disabled from `getAllowedDirectionsForDate(date)` instead of a hardcoded summer disable or a union of “open” periods.

**What changed:**

| Area | Behavior |
| ---- | -------- |
| Canonical data | `servicePeriods.ts` — dual-direction rows (Thanksgiving, Spring), split winter outbound/return rows, summer outbound-only |
| Derived lists | `subsidyConfig.ts` re-exports `COVERED_DATES_*` from subsidized ranges (fixes Summer `05-12` format) |
| Deadlines | `flightValidation.ts` delegates to helpers; display uses **PT** labels |
| Flight form | See **Flight form step order** below |
| Policy page | Shows the **last** `SERVICE_PERIODS` entry (current break) |
| Ops | Edit `servicePeriods.ts` only — see [`OPERATIONS.md`](./OPERATIONS.md) |

**Flight form step order**

Previously step 1 was trip direction + airport and step 2 was date + flight details. Direction was not tied to the selected date (e.g. “To Campus” was hard-disabled for all of summer).

| Step | Before | After |
| ---- | ------ | ----- |
| 1 | Trip direction + airport | **Ride date** + airport (deadline check runs here) |
| 2 | Date + times + flight info | **Trip direction** + times + flight info |

On step 2, each direction button is enabled only if the ride date falls in that direction’s **subsidized** range for a period in `servicePeriods.ts` (via `getAllowedDirectionsForDate`). Examples: Summer May 15 → outbound only; Spring Mar 14 → outbound only; Spring Mar 21 → inbound only. If the date is outside subsidized windows but still submittable (non-subsidized path), both directions stay selectable. Changing the date clears a direction selection that is no longer valid.

**Reasonable fix for the audit:** frontend canonical config + tests + helpers + wired consumers is complete for Item 7. We also improved the flight form so that users are limited to choosing the correct trip direction for their date.

**Tests:**

```bash
pnpm test -- src/config/servicePeriodHelpers.test.ts src/utils/flightValidation.test.ts
```
**Why ML `config.py` was not unified in this item**

The audit finding was **frontend drift**: the same break dates lived in three TypeScript files (`subsidyConfig.ts`, `flightValidation.ts`, `FlightForm` inline `operationalPeriods`). Item 7 closes that by making [`servicePeriods.ts`](src/config/servicePeriods.ts) the single source for everything the **web app** reads — form deadlines, direction gating, admin subsidy lists, and the policy page — with 58+ tests locking behavior.

The ML matching service is a **separate repo** with its own `config.py`, runs on a **batch schedule** (not on student request paths), and does **not** read `servicePeriods.ts`, Postgres, or the frontend subsidy exports today. 

- Drift risk is minimal now and is **documented** in [`OPERATIONS.md`](./OPERATIONS.md). Now with **one** TS file instead of three.
- A shared artifact is **possible to add later** without redoing this work: e.g. `pnpm export:service-periods` → `service_periods.json` for the ML repo to use, or a shared Supabase table if multi-runtime sync becomes painful.

---

## Remediation Issue #9

**Audit item:** Page loads perform duplicate client-side authentication/profile requests, broad Supabase reads, blocking Results writes, and expensive client-side admin aggregation.

**Status:** Completed

**Summary:** A server-hydrated shared auth/profile provider removed duplicate Header, page, and nested-component identity queries; explicit Supabase field lists and response DTOs reduced payloads and prevent broad reads from returning. Results and Unmatched receive their initial data from the server, Results renders before one batched background readiness write, and the Admin dashboards use protected server aggregation, bounded pagination, deferred panels, consolidated mutations, visible progress, and reproducible timing/payload telemetry.

**Remediation completed:**

- **Authentication and profile state:** Added one root `AuthProvider` for user, profile, role, admin scope, school, and avatar state. Results, Unmatched, and Admin layouts hydrate that provider from a server-validated principal. The Header, pages, forms, cards, and comments reuse the shared state instead of issuing independent `getUser()` or role/profile queries. Session changes, sign-out, OAuth return paths, profile refresh, and immediate avatar updates were preserved.
- **Supabase query scope:** Replaced broad reads in the affected Results, Unmatched, profile-validation, Admin, Match Request, comment, and Admin Groups mutation paths with explicit field lists. Added DTO serializers for Results, Unmatched, profile completeness, Admin summary, and Admin Groups responses so undeclared fields are removed before reaching the browser. Automated coverage rejects both `select('*')` and empty `.select()` calls anywhere in production TypeScript and verifies exact response keys for the principal read models.
- **Results rendering:** Results data is committed to the page and loading is cleared before readiness persistence begins. Eligible ride IDs are deduplicated into one background request instead of sequential per-ride writes. The server validates membership for the full batch before updating, preserves existing readiness timestamps, and writes only rows whose `group_ready_at` remains null. Background failure does not remove rendered match data.
- **Server-loaded initial content:** Results and Unmatched layouts now load their minimal DTOs with the authenticated server principal and seed the client pages. Initial content no longer waits for a post-hydration browser fetch; later user-requested refreshes continue through the protected APIs.
- **Main Admin dashboard:** Added admin-protected `GET /api/admin/dashboard-summary` and moved summary aggregation to the server. Algorithm status, schedule, and unmatched count begin concurrently; match-rate reads retain only their required dependency on the last completed run. The browser receives the nine values displayed by the dashboard. Cancellation and no-show reports remain date-bounded, user-triggered reads and do not block initial rendering. Initial loading now uses the same visible spinner treatment as Admin Groups so administrators receive immediate progress feedback while the summary loads.
- **Admin Groups dashboard:** Added admin-protected `GET /api/admin/groups/snapshot` for the primary matched/unmatched read model. It applies a default seven-days-back through one-month-forward window, validates a maximum 366-day range, and paginates Flights at 200 records before related hydration. The snapshot and algorithm status run concurrently, user batches run concurrently, and complete groups use a stable anchor so they appear on only one page. Changelog is loaded on expansion in 100-entry pages; pending changes load only when the Changes tab is opened. Date and page refreshes retain the current dashboard while loading.
- **Database read-model evaluation:** A reproducible 200-rider/50-group fixture produced one approximately 70.5 KiB browser response. The server performed six narrow reads including algorithm status and processed approximately 145 KiB across 801 selected rows. The bounded transfer and processing volume did not justify introducing a database view or read-only RPC. No view, RPC, index, schema, or policy change was made.
- **Admin supporting reads:** Date-filtered reports, rider and contact lookups, school/user lists, duplicate-flight checks, deferred changelog/pending panels, and CSV exports now use admin-protected server endpoints. Active Admin and Admin Groups components no longer query Supabase directly for those reads.
- **Admin Groups interaction latency:** Successful rider edits and group creation patch local state without reloading the full snapshot. Moving a rider to unmatched, the corral, or another group uses one protected browser command that performs match, flight-status, source/destination metadata, pending-change confirmation, and audit work server-side. Changelog writes return their inserted audit entries so an already-open changelog can merge only the new rows into its bounded local list, preserving deferred loading while avoiding stale entries after re-adding a rider to a group. Per-rider saving states prevent duplicate actions and provide immediate feedback. Authoritative snapshot reconciliation remains limited to failed writes, and hidden changelog/pending panels are not refreshed by mutations.
- **Performance telemetry:** Critical Results, Unmatched, Admin summary, and Admin Groups snapshot responses include `Server-Timing` duration and `X-Response-Bytes` headers. This permits authenticated browser or monitoring captures against production-like data without logging sensitive response bodies; automated coverage preserves the header contract.

**Evidence and supporting materials:**

- `documentation/PERFORMANCE_BASELINE.md` records the original request dependencies, remediated request paths, representative payload measurements, and database read-model decision.
- `src/providers/AuthProvider.test.tsx` verifies one shared initialization, server hydration without client auth/profile reads, session changes, profile refresh, and avatar propagation.
- `src/contracts/readModels.test.ts` and `src/contracts/readModelCoverage.test.ts` verify exact response shapes and prohibit production star or empty-column selections.
- `src/app/results/page.test.tsx` and `src/lib/server/studentCommands.test.ts` verify render-before-write behavior, batching, membership validation, idempotency, and background-write failure handling.
- Admin dashboard and Admin Groups tests verify concurrent reads, bounded dates and pages, admin-scope filtering/redaction, cross-page group behavior, and deferred changelog/pending panels.
- Admin Groups mutation tests verify single-command browser contracts, ride and user/flight scope rejection, removal persistence and changelog behavior, returned audit entries for incremental open-panel updates, local-state updates after successful creation, and visible pending-state action blocking.
- `src/lib/server/performanceResponse.test.ts` verifies the reproducible server-duration and serialized-payload telemetry headers.

**Current verification:**

- `pnpm type-check`, `pnpm lint`, `pnpm knip`, and `pnpm knip:production` - passed with no findings.
- `pnpm exec jest --ci --runInBand` - 22 suites and 140 tests passed.
- `pnpm build` - passed; 48 application route entries generated, including the protected Admin summary, groups snapshot/command, report, lookup, secondary-panel, and export endpoints.
- Production-build route smoke tests confirmed Results, Unmatched, Admin, and Admin Groups reject missing sessions and preserve their complete return destinations. The Admin Groups snapshot and command endpoints returned `401 Unauthorized` without a session, and local browser smoke testing reported no console errors.
- Authenticated warm-reload measurements against the local production build reached principal content at median times of 710 ms for Results, 646 ms for Unmatched, 672 ms for Admin, and 790 ms for Admin Groups. A representative Group #736 rider mutation became visible in 404 ms when removed and 703 ms when re-added from the Corral; the complete Unmatched-to-Corral-to-group re-add work took 1.34 seconds. `documentation/PERFORMANCE_BASELINE.md` records the tested rider, restoration, raw page runs, capture procedures, payload evidence, and measurement limitations.
- Follow-up changelog verification: `pnpm exec jest --runInBand src/components/admin/groups-management/services/groupsWriteService.test.ts src/lib/server/adminGroupsCommands.test.ts src/app/api/admin/groups/command/route.test.ts`, `pnpm exec jest --runInBand src/components/admin/GroupsManagement.test.tsx`, and `pnpm type-check` passed after adding incremental audit-entry merging.
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
