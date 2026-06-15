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

| `matching_status` | Replaces `matched` | Meaning                           |
| ----------------- | ------------------ | --------------------------------- |
| `submitted`       | `null`             | Filed; awaiting batch matcher     |
| `unmatched`       | `false`            | Post-matcher; no group            |
| `matched`         | `true`             | In a group (`Matches` row exists) |

**Filter rules (unchanged product behavior, new column):**

| Surface                                | Filter                         |
| -------------------------------------- | ------------------------------ |
| Student `/unmatched` coordination pool | `unmatched` only               |
| `/questionnaires` Upcoming             | `submitted`                    |
| `/questionnaires` Unmatched section    | `unmatched`                    |
| Admin dashboard unmatched count + CSV  | `submitted` + `unmatched`      |
| Admin groups unmatched riders panel    | `matching_status <> 'matched'` |

### Database

`CREATE OR REPLACE` on eight RPCs that read or wrote `matched`:

| RPC                            | Change                                                     |
| ------------------------------ | ---------------------------------------------------------- |
| `accept_match_request`         | Guards and sets `matching_status = 'matched'`              |
| `cancel_own_match`             | Sets `matching_status = 'unmatched'`                       |
| `create_group_records`         | Sets `matching_status = 'matched'` for group riders        |
| `delete_group_records`         | Optional `matching_status = 'unmatched'`                   |
| `aspc_delay_move_to_unmatched` | Sets `matching_status = 'unmatched'`                       |
| `aspc_delay_decline_groups`    | Sets `matching_status = 'unmatched'`                       |
| `update_own_flight_tx`         | 409 guard uses `matching_status = 'matched'` (with Item 4) |
| `delete_own_flight_tx`         | Same read guard                                            |

### Deferred (Phase 4) - STILL TODO

- `p_cancelled_after_deadline` on `cancel_own_match` + TS pre-fetch in `cancelOwnMatch` (today RPC still hardcodes `cancelled_after_deadline = true`).
- `DROP COLUMN matched` after soak.

### Files

| File                                                         | Change                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `supabase-migrations/2026-06-11_matching_status_cutover.sql` | RPC cutover                                         |
| `src/utils/matchingStatus.ts`                                | Canonical status helpers                            |
| `src/utils/matchingStatus.test.ts`                           | Helper tests                                        |
| `src/lib/server/studentCommands.ts`                          | Reads/writes `matching_status`; FK-qualified embeds |
| `src/lib/server/adminGroupsCommands.ts`                      | `matching_status` updates                           |
| `src/lib/server/aspcDelayCommands.ts`                        | FK-qualified embeds                                 |
| `src/app/questionnaires/page.tsx`                            | Status-based sections                               |
| `src/components/forms/FlightForm.tsx`                        | `matching_status` on load                           |
| `src/components/admin/AdminDashboard.tsx`                    | Dashboard count filter                              |
| `src/components/admin/GroupsManagement.tsx`                  | Admin mark-matched API                              |
| `src/app/api/admin/groups/command/route.ts`                  | `matchingStatus` in payload                         |
| `src/lib/server/studentCommands.test.ts`                     | RPC/status mocks updated                            |
| `src/lib/server/adminGroupsCommands.test.ts`                 | Update payload tests                                |

**Tests**

```bash
pnpm test -- src/utils/matchingStatus.test.ts src/lib/server/studentCommands.test.ts src/lib/server/adminGroupsCommands.test.ts
```

---

## Remediation Issue #6

**Audit item:** Server-side flight validation allowed incomplete or unrealistic values to reach database writes.

**Status:** Completed

**Summary:** Implemented one server-side validation contract for student and Admin Groups flight creation/editing. All flight-detail payloads are validated before database writes, malformed direct API requests are rejected with safe field-level errors, and browser controls enforce the same limits.

### Remediation completed

- Applied the shared validator to `POST /api/flights`, `PATCH /api/flights/[flightId]`, Admin Groups `add_unmatched_flight`, and Admin Groups `update_flight_record`.
- Required complete creation payloads and rejected unsupported fields. Partial edits validate every supplied field before the update or RPC call.
- Replaced PostgreSQL messages and hints on flight submission, lookup, and update failures with user-safe responses containing a stable validation code and field where applicable.
- Aligned `FlightForm`, Admin Add Rider, and Admin Edit Rider controls with the server contract.

### Validation contract

| Field                  | Server requirement                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Date                   | Real `YYYY-MM-DD` date within 365 calendar days before or after the current date       |
| Airport                | Normalized to uppercase; `LAX` or `ONT` only                                           |
| Flight number          | Integer from `1` through `9999`                                                        |
| Airline code           | Two alphanumeric characters with at least one letter                                   |
| Personal/carry/checked | Each bag count must be an integer from `0` through `10`                                |
| Times                  | Valid 24-hour values; an earlier latest time represents an intentional next-day window |
| Terminal               | Optional; maximum 50 characters and no control characters                              |

Service-period eligibility remains in the matching workflow because valid non-subsidized requests may be submitted outside subsidized travel periods.

### Testing and evidence

`flightWritePayload.test.ts` covers required fields, invalid formats and years, impossible dates, inclusive date boundaries, all bag fields, airports, flight and airline formats, terminal limits, invalid times, overnight windows, unsupported fields, and partial edits. Student and admin command tests confirm invalid payloads do not reach database writes and database internals are not returned.

```bash
pnpm type-check
pnpm lint
pnpm test -- --runInBand
pnpm knip:production
pnpm build
```

**Results:** Type checking passed; lint passed with no warnings or errors; Knip reported no unused production findings; the production build completed successfully; all 27 test suites passed with 236 tests.

No database schema, policy, trigger, function, or RPC changes were required.

---

## Item 7 — Canonical `servicePeriods` config

**Audit item:** Subsidized dates, buffered windows, deadlines, and trip-direction rules were split across `subsidyConfig.ts`, `flightValidation.ts` `SERVICE_PERIODS`, and inline `FlightForm` `operationalPeriods`.

**Status:** Completed (frontend)

**Summary:** One coder-edited config in `src/config/servicePeriods.ts` drives subsidy lists, deadline enforcement, flight-form direction gating, and the ASPC policy page. Pure helpers in `servicePeriodHelpers.ts` are covered by golden tests. The flight form wizard was **reordered** so students pick **ride date first**; **To Airport / To Campus** buttons on step 2 are enabled or disabled from `getAllowedDirectionsForDate(date)` instead of a hardcoded summer disable or a union of “open” periods.

**What changed:**

| Area           | Behavior                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Canonical data | `servicePeriods.ts` — dual-direction rows (Thanksgiving, Spring), split winter outbound/return rows, summer outbound-only |
| Derived lists  | `subsidyConfig.ts` re-exports `COVERED_DATES_*` from subsidized ranges (fixes Summer `05-12` format)                      |
| Deadlines      | `flightValidation.ts` delegates to helpers; display uses **PT** labels                                                    |
| Flight form    | See **Flight form step order** below                                                                                      |
| Policy page    | Shows the **last** `SERVICE_PERIODS` entry (current break)                                                                |
| Ops            | Edit `servicePeriods.ts` only — see [`OPERATIONS.md`](./OPERATIONS.md)                                                    |

**Flight form step order**

Previously step 1 was trip direction + airport and step 2 was date + flight details. Direction was not tied to the selected date (e.g. “To Campus” was hard-disabled for all of summer).

| Step | Before                     | After                                              |
| ---- | -------------------------- | -------------------------------------------------- |
| 1    | Trip direction + airport   | **Ride date** + airport (deadline check runs here) |
| 2    | Date + times + flight info | **Trip direction** + times + flight info           |

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

**Summary:** Authentication and profile state are loaded once and shared across the application. Results and Unmatched receive server-loaded data, broad Supabase reads were replaced with explicit response contracts, Results no longer waits for readiness writes, and Admin dashboards now use paginated server aggregation with deferred panels and responsive mutation feedback.

**Remediation completed:**

- **Client-side auth and profile waterfalls:** Added one server-hydrated `AuthProvider` for user, profile, role, school, admin scope, and avatar state. The Header, pages, and nested components reuse this state instead of repeating authentication and profile queries. Results and Unmatched receive their initial data during server rendering.
- **Over-fetching:** Replaced broad Supabase reads with explicit column lists and DTOs for Results, Unmatched, profile completeness, Admin summaries, and Admin Groups. Automated tests reject production `select('*')` or empty selections and verify exact API response fields.
- **Results page blocking:** Results render as soon as match data is available. Readiness updates run afterward through one deduplicated, idempotent batch request; write failures do not hide the rendered results.
- **Main Admin dashboard:** Moved displayed metrics to the protected `/api/admin/dashboard-summary` endpoint, parallelized independent reads, and kept date-filtered reports lazy. The dashboard shows a loading indicator while its summary is requested.
- **Admin Groups:** Moved group and unmatched aggregation to protected server endpoints with a default date window and pagination. Algorithm status and the main snapshot load concurrently; changelog and pending changes load only when opened. Admin supporting reads no longer query Supabase directly from active client components.
- **Admin mutation latency:** Rider and group changes use consolidated server commands and update local state immediately after success instead of reloading the full snapshot. Per-rider progress states prevent duplicate actions and make in-progress changes visible.
- **Database read-model decision:** A 200-rider/50-group fixture produced an approximately 70.5 KiB browser response and approximately 145 KiB of bounded server reads. A database view or RPC was not necessary, and no schema or policy changes were made.
- **Telemetry:** Results, Unmatched, Admin summary, and Admin Groups responses expose `Server-Timing` and `X-Response-Bytes` headers for repeatable production-like measurements.

**Evidence and supporting materials:**

- `documentation/PERFORMANCE_BASELINE.md` records before/after request paths, payload measurements, authenticated timings, and the database read-model decision.
- Auth provider, DTO, Results, Admin dashboard, Admin Groups, mutation, and performance-header tests cover the behaviors above.

**Current verification:**

- `pnpm type-check`, `pnpm lint`, `pnpm knip`, and `pnpm knip:production` - passed with no findings.
- `pnpm exec jest --ci --runInBand` - passed.
- `pnpm build` - passed; 48 routes generated.
- Protected route and API smoke tests passed with no browser console errors.
- Authenticated median time to principal content: Results 710 ms, Unmatched 646 ms, Admin 672 ms, and Admin Groups 790 ms.
- Admin Groups rider removal became visible in 404 ms and re-addition in 703 ms; the full unmatched-to-group workflow completed in 1.34 seconds.

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

## Remediation Issue #11

**Audit item:** Pull-request CI did not guarantee lockfile reproducibility or provide dependency, database compatibility, and business-rule release assurance.

**Status:** Completed

**Summary:** Pull-request CI now uses frozen installs and separate blocking checks for the production build, security audit, dependency review, database contract, static analysis, and tests. Release-critical coverage verifies API authorization, matching transitions, and deadline enforcement. CI does not connect to or modify production.

**Remediation completed:**

- **Frozen lockfile:** Replaced `--no-frozen-lockfile` with `pnpm install --frozen-lockfile`; manifest and lockfile drift now fail CI.
- **Production build:** Added a separate blocking `Production Build` job using non-production compile-time values and no database credentials.
- **Security audit and dependency review:** Added blocking high/critical `pnpm audit` and dependency-review checks. Updated affected dependencies, enabled Dependabot security alerts and automatic fixes, and added scheduled pnpm and GitHub Actions updates.
- **Schema/RPC compatibility:** Added a full-source static contract test for every public table referenced by production code and all 12 application RPC names and arguments. Generated types were reconciled with read-only production metadata; no database changes were made.
- **API authorization tests:** Covered invalid sessions, non-admin users, unreadable profiles, admin scope, cross-user access, protected-handler short-circuiting, and route-wide authorization-wrapper enforcement.
- **Matching-transition tests:** Covered request eligibility, matched-flight rejection, acceptance and cancellation failures, removal to unmatched, re-addition to a group, admin-created unmatched flights, and failed-transition audit behavior.
- **Deadline-enforcement tests:** Covered create, update, and delete operations across winter, spring, and summer periods, PST/PDT offsets, exact and expired deadlines, and dates outside configured periods. Replacement dates are validated server-side to prevent API bypass.
- **Workflow safeguards:** Checks have timeouts, read-only repository permissions, and cancellation of superseded pull-request runs.

**Security audit results:**

- Before: 8 high, 11 moderate, and 3 low advisories.
- After: zero high or critical advisories. Two visible moderate transitive findings remain in Next.js/PostCSS and Jest/jsdom test tooling.

**Current verification:**

- `pnpm install --frozen-lockfile` - passed.
- `pnpm audit:security` - passed with zero high or critical findings.
- `pnpm test:database-contract` - passed; 10 production-referenced public tables and all 12 application RPC contracts matched generated database types.
- `pnpm type-check`, `pnpm knip`, `pnpm knip:production`, and `pnpm lint` - passed.
- `pnpm test:ci --passWithNoTests --runInBand` - 26 suites and 202 tests passed.
- `pnpm build` - passed on Next.js 15.5.18 and generated 48 route entries.
- Built-server smoke checks passed for public access, protected-page redirects, and `401` responses from protected Results, Admin, flight, match-request, and match-cancellation endpoints.
- Production database structures and data were unchanged.

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
