# PICKUP Frontend Remediation Notice

This document records frontend repository remediation work for the ASPC Required Remediation Items dated June 10, 2026. Issues #1-#3 apply to the separate ML repository and are not duplicated here. This frontend notice covers Issues #4-#12.

Each section describes the remediation completed, relevant repository updates, supporting documentation, and verification evidence for ASPC review and any follow-up re-audit.

## Verification Metadata

| Field                                | Value                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Repository                           | `p-ickup/frontend`                                                                                         |
| Frontend remediation branch          | `remediations-francisco`                                                                                   |
| Local documentation review timestamp | `2026-06-17 07:18:03 CST`                                                                                  |
| Local HEAD at documentation review   | `5ce086b0a981364529528727e685553dfdb39238`                                                                 |
| Pull request                         | [p-ickup/frontend#121](https://github.com/p-ickup/frontend/pull/121)                                       |
| Pull-request workflow                | `.github/workflows/pull-request.yaml`                                                                      |
| CI reference                         | Use the final checks from PR #121 and the merge commit when providing ASPC with the signed written notice. |

## Issue #4 - Matched Flight Data Can Become Inconsistent

**Audit concern:** Matched flights could be edited or deleted through direct API paths, creating drift between `Flights` rows, match records, and the cancellation workflow.

**Status:** Completed

**Summary:** Matched flight edits and deletes are now blocked at the server/database boundary unless the user goes through the dedicated match-cancellation workflow. The app returns a controlled conflict response instead of allowing inconsistent writes or exposing database errors.

**Remediation completed:**

- Added transactional Postgres RPCs for user-owned flight update and delete operations.
- Locked the target flight row, verified ownership through `auth.uid()`, and rejected matched flights or flights with `Matches` rows.
- Restricted update payloads to approved flight fields and prevented direct mutation of match state.
- Deleted pending match requests involving the flight only after ownership and match-state checks pass.
- Updated the flight edit/delete API to call the RPCs with the authenticated session client so database ownership checks evaluate correctly.

**Repository updates:**

- `supabase-migrations/2026-06-11_own_flight_mutations_tx.sql`
- `src/lib/server/studentCommands.ts`
- `src/app/api/flights/[flightId]/route.ts`
- `src/lib/server/studentCommands.test.ts`

**Supporting documentation:** The RPC migration documents the transactional ownership and match-state guards used by the frontend API.

**Verification evidence:**

- `pnpm test -- src/lib/server/studentCommands.test.ts` - passed.
- Tests verify RPC names and parameters, ownership-aware conflict handling, and that matched state cannot be sent in update payloads.

## Issue #5 - Flight Match-State Cutover

**Audit concern:** Flight lifecycle state was split between the legacy nullable boolean `Flights.matched` and newer `matching_status` logic, creating ambiguous filters and drift risk.

**Status:** Completed

**Summary:** The frontend and active RPC paths now use `matching_status` as the single application match-state field with explicit `submitted`, `unmatched`, and `matched` states.

**Remediation completed:**

- Replaced frontend reads, filters, and writes that depended on `Flights.matched` with canonical `matching_status` helpers.
- Updated eight active RPC definitions that create, accept, cancel, decline, update, delete, or move matched/unmatched records.
- Preserved existing product behavior while making submitted, unmatched, and matched states explicit.
- Updated cancellation handling so `cancelled_after_deadline` is passed from the same canonical deadline helper used by flight edit/delete checks.

**Repository updates:**

- `supabase-migrations/2026-06-11_matching_status_cutover.sql`
- `supabase-migrations/2026-06-14_cancel_own_match_deadline.sql`
- `src/utils/matchingStatus.ts`
- `src/lib/server/studentCommands.ts`
- `src/lib/server/adminGroupsCommands.ts`
- `src/lib/server/aspcDelayCommands.ts`
- `src/app/questionnaires/page.tsx`
- `src/components/forms/FlightForm.tsx`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/GroupsManagement.tsx`

**Supporting documentation:** The migrations capture the database-side RPC cutover and deadline parameter used by the application cancellation path.

**Verification evidence:**

- `pnpm test -- src/utils/matchingStatus.test.ts src/lib/server/studentCommands.test.ts src/lib/server/adminGroupsCommands.test.ts` - passed.
- Tests verify status helpers, student cancellation/update/delete behavior, and admin group status transitions.

## Issue #6 - Server-Side Flight Validation Is Incomplete

**Audit concern:** Direct API calls could submit incomplete or unrealistic flight values, including invalid years, unsupported airports, excessive bag counts, malformed airline or flight numbers, and unsafe time/date values.

**Status:** Completed

**Summary:** Student and Admin Groups flight writes now share one server-side validation contract before database writes. Invalid direct API calls return safe validation errors with stable fields and codes rather than database internals.

**Remediation completed:**

- Applied shared validation to student flight creation, student flight editing, Admin Groups add-rider, and Admin Groups edit-rider flows.
- Required complete creation payloads and validated every supplied edit field.
- Enforced practical limits: real `YYYY-MM-DD` dates within 365 days before or after the current date, airports limited to `LAX` or `ONT`, flight numbers from `1` to `9999`, two-character alphanumeric airline codes with at least one letter, bag counts from `0` to `10`, valid 24-hour times, and safe optional terminal text.
- Allowed intentional overnight time windows when latest time is earlier than earliest time.
- Kept service-period matching eligibility outside submission validation so valid non-subsidized rides can still be submitted.
- Aligned browser controls and admin error placement with the server contract.

**Repository updates:**

- `src/lib/server/flightWritePayload.ts`
- `src/utils/flightValidation.ts`
- `src/app/api/flights/route.ts`
- `src/app/api/flights/[flightId]/route.ts`
- `src/lib/server/adminGroupsCommands.ts`
- `src/components/forms/FlightForm.tsx`
- `src/components/admin/groups-management/AddRiderModal.tsx`
- `src/components/admin/groups-management/EditRiderModal.tsx`

**Supporting documentation:** Validation behavior is captured in unit tests and this notice; no database schema, trigger, policy, or RPC change was required for this remediation.

**Verification evidence:**

- `pnpm type-check` - passed.
- `pnpm lint` - passed.
- `pnpm test -- --runInBand` - passed.
- `pnpm knip:production` - passed.
- `pnpm build` - passed.
- `src/lib/server/flightWritePayload.test.ts` covers required fields, invalid formats and years, impossible dates, inclusive date boundaries, bag limits, airport and airline formats, terminal limits, invalid times, overnight windows, unsupported fields, and partial edits.
- Student and admin command tests confirm invalid payloads do not reach database writes and database internals are not returned.

## Issue #7 - Service Period Configuration Drift

**Audit concern:** Subsidized dates, buffered windows, deadlines, and trip-direction rules were duplicated across multiple frontend files, increasing drift risk.

**Status:** Completed

**Summary:** Frontend service periods now have one canonical TypeScript source used by deadlines, subsidy lists, trip-direction gating, the flight form, and the ASPC policy page.

**Remediation completed:**

- Centralized frontend service-period data in `src/config/servicePeriods.ts`.
- Added pure helper functions for deadlines, covered dates, direction eligibility, and display formatting.
- Rewired existing subsidy exports and flight validation to derive from the canonical config.
- Reordered the flight form so users select date before trip direction; direction availability is now derived from the selected date.
- Updated operations documentation so future edits are made in one file.

**Repository updates:**

- `src/config/servicePeriods.ts`
- `src/config/servicePeriodHelpers.ts`
- `src/config/subsidyConfig.ts`
- `src/utils/flightValidation.ts`
- `src/components/forms/FlightForm.tsx`
- `src/app/aspc-policy/page.tsx`
- `documentation/OPERATIONS.md`

**Supporting documentation:** `documentation/OPERATIONS.md` identifies `servicePeriods.ts` as the frontend source of truth and explains how future period updates should be made.

**Verification evidence:**

- `pnpm test -- src/config/servicePeriodHelpers.test.ts src/utils/flightValidation.test.ts` - passed.
- Tests cover service-period ranges, deadline checks, direction eligibility, covered-date exports, and display behavior.

## Issue #8 - Ride-Member Flight Privacy

**Audit concern:** The ride-member `Flights` RLS policy permits users on the same ride to read peer flight rows. The app had a shared-ride read path that requested more peer flight fields than coordination required.

**Status:** Completed

**Summary:** Shared-ride Results reads now request only coordination fields needed by riders and serialize the response through explicit DTOs before data reaches the browser.

**Remediation completed:**

- Replaced the broad `Flights (*)` embed in the Results match read with explicit coordination fields.
- Returned peer flight information only where required for ride coordination.
- Kept RLS unchanged; row-level access remains enforced by existing ride-member policies.
- Added source scanning that fails if production TypeScript reintroduces `select('*')`, empty `.select()`, or broad `Flights (*)` embeds.

**Repository updates:**

- `src/lib/server/studentCommands.ts`
- `src/contracts/readModels.ts`
- `src/contracts/readModels.test.ts`
- `src/contracts/readModelCoverage.test.ts`

**Supporting documentation:** `documentation/RLS_POLICY_EVIDENCE.md` records the reviewed production RLS posture and confirms no database policy change was made for this frontend query-scope remediation.

**Verification evidence:**

- `pnpm test -- src/contracts/readModelCoverage.test.ts src/contracts/readModels.test.ts src/lib/server/studentCommands.test.ts` - passed.
- Tests verify exact Results response shape and prohibit broad production Supabase selects.

## Issue #9 - Performance and Page Load Concerns

**Audit concern:** Pages performed duplicate client-side auth/profile requests, over-fetched Supabase data, blocked Results rendering on write requests, and computed expensive Admin Groups state in the browser.

**Status:** Completed

**Summary:** Auth/profile state is centralized, key reads use explicit DTOs, Results renders before background readiness writes, and Admin/Admin Groups load through protected bounded server endpoints with pagination, deferred panels, local optimistic updates, visible loading states, and timing telemetry.

**Remediation completed:**

- Added one shared auth/profile provider hydrated from server-validated session context where available.
- Removed duplicate Header, page, and nested-component auth/profile queries by reusing shared user, profile, role, school, admin-scope, and avatar state.
- Replaced broad Supabase reads with explicit field lists and DTO serializers for Results, Unmatched, profile completeness, Admin summary, and Admin Groups responses.
- Added exact response-shape tests and production source scanning to prevent accidental response expansion.
- Changed Results so match data renders first and readiness persistence runs afterward as one idempotent batched request.
- Added protected Admin summary and Admin Groups snapshot endpoints that perform bounded server aggregation, date-window filtering, pagination, and concurrent independent reads.
- Deferred non-critical Admin Groups changelog and pending-change panels until requested.
- Consolidated Admin Groups rider mutations so successful remove, re-add, move, and create actions patch local state quickly while preserving authoritative server checks.
- Added visible loading and saving states to Admin and Admin Groups workflows.
- Added `Server-Timing` and `X-Response-Bytes` telemetry headers for critical performance endpoints.
- Evaluated database read models using measured optimized endpoint payloads; no database view, RPC, index, schema, or policy change was needed.

**Repository updates:**

- `src/providers/AuthProvider.tsx`
- `src/providers/InitialPageDataProvider.tsx`
- `src/contracts/readModels.ts`
- `src/lib/server/performanceHeaders.ts`
- `src/app/results/page.tsx`
- `src/app/results/layout.tsx`
- `src/app/unmatched/page.tsx`
- `src/app/unmatched/layout.tsx`
- `src/app/api/results/route.ts`
- `src/app/api/unmatched/options/route.ts`
- `src/app/api/matches/mark-group-ready/route.ts`
- `src/app/api/admin/dashboard-summary/route.ts`
- `src/app/api/admin/groups/snapshot/route.ts`
- `src/app/api/admin/groups/command/route.ts`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/GroupsManagement.tsx`
- `src/lib/server/adminDashboard.ts`
- `src/lib/server/adminGroupsCommands.ts`
- `src/components/admin/groups-management/services/groupsReadService.ts`
- `src/components/admin/groups-management/services/groupsWriteService.ts`
- `src/components/admin/groups-management/hooks/useGroupsDataOrchestration.ts`
- `src/components/admin/groups-management/hooks/useGroupsDerivedData.ts`
- `src/components/admin/groups-management/types.ts`
- `src/components/admin/groups-management/services/groupsReadService.test.ts`
- `src/components/admin/groups-management/services/groupsWriteService.test.ts`
- `src/components/admin/groups-management/hooks/useGroupsDataOrchestration.test.tsx`
- `src/app/api/admin/groups/snapshot/route.test.ts`
- `src/app/api/admin/groups/command/route.test.ts`

**Supporting documentation:** `documentation/PERFORMANCE_BASELINE.md` records baseline findings, optimized request paths, payload evidence, authenticated timing captures, Admin Groups rider mutation timing, and the database read-model decision.

**Verification evidence:**

- `pnpm type-check` - passed.
- `pnpm lint` - passed.
- `pnpm knip` - passed.
- `pnpm knip:production` - passed.
- `pnpm exec jest --ci --runInBand` - passed for the performance-focused suite.
- `pnpm build` - passed.
- Route smoke tests confirmed Results, Unmatched, Admin, and Admin Groups preserve protected redirects and reject missing sessions.
- Authenticated local production-build timing reached principal content at median times of 710 ms for Results, 646 ms for Unmatched, 672 ms for Admin, and 790 ms for Admin Groups.
- Admin Groups rider mutation timing showed remove visible in 404 ms and re-add visible in 703 ms for the measured rider flow.

## Issue #10 - Middleware and Authorization Architecture

**Audit concern:** Middleware refreshed Supabase sessions on nearly all routes without central route protection. Authorization was scattered across pages, API helpers, RLS, and RPC calls, increasing the chance of missed checks.

**Status:** Completed

**Summary:** Route access is centrally defined, middleware runs only for protected pages, and API handlers use authenticated or admin wrappers. Database-level ownership, membership, admin-scope, RLS, and RPC controls remain in force.

**Remediation completed:**

- Added a central route-access policy for public, authenticated, and admin pages.
- Limited middleware to protected page routes and replaced session-only checks with server-validated user checks.
- Preserved safe internal return destinations and rejected external, malformed, protocol-relative, and backslash-based return URLs.
- Consolidated admin authorization into the shared server auth module.
- Added `withAuthenticatedRoute` and `withAdminRoute` wrappers and applied them across API handlers.
- Standardized missing-session responses as `401 Unauthorized` and authenticated-but-forbidden responses as `403 Forbidden`.
- Preserved role, school admin scope, record ownership, ride membership, RLS, and RPC authorization at the API/database boundary.
- Reviewed production RLS, storage policies, grants, and relevant security-definer RPCs without changing production database policies or functions.
- Added negative tests for public/protected routing, unsafe return URLs, missing sessions, non-admin users, out-of-scope admins, cross-user access, and cookie refresh behavior.

**Repository updates:**

- `src/config/routeAccess.ts`
- `middleware.ts`
- `src/lib/server/auth.ts`
- `src/app/api/results/route.ts`
- `src/app/api/unmatched/options/route.ts`
- `src/app/api/flights/route.ts`
- `src/app/api/flights/[flightId]/route.ts`
- `src/app/api/admin/dashboard-summary/route.ts`
- `src/app/api/admin/groups/snapshot/route.ts`
- `src/app/api/admin/groups/command/route.ts`
- `src/app/api/admin/reports/route.ts`
- `src/app/api/admin/lookup/route.ts`
- `src/app/api/admin/groups/export/route.ts`
- `src/config/routeAccess.test.ts`
- `src/lib/server/auth.test.ts`
- `src/lib/server/adminScope.test.ts`
- API authorization coverage tests for route wrappers and command ownership

**Supporting documentation:**

- `documentation/SERVICE_ROLE_AUTHORIZATION.md`
- `documentation/RLS_POLICY_EVIDENCE.md`
- `documentation/RLS_POLICY_AUDIT.sql`
- `documentation/RLS_POLICY_FOLLOWUP.sql`

**Verification evidence:**

- `pnpm type-check` - passed.
- `pnpm knip` - passed.
- `pnpm knip:production` - passed.
- `pnpm lint` - passed.
- `pnpm test:ci --passWithNoTests --runInBand` - passed for the authorization-focused suite.
- `pnpm build` - passed.
- Smoke tests confirmed public routes avoid session work, protected routes redirect with complete return destinations, representative APIs reject missing sessions with `401`, and admin-only APIs reject non-admin users with `403`.

## Issue #11 - CI Does Not Provide Strong Release Assurance

**Audit concern:** Pull-request CI allowed non-frozen installs and lacked blocking production build, dependency audit, dependency review, schema/RPC compatibility, and release-critical business-rule tests.

**Status:** Completed

**Summary:** Pull-request CI now has separate blocking checks for frozen installs, static analysis, tests, production build, security audit, dependency review, and static database contract compatibility. CI never connects to or modifies production.

**Remediation completed:**

- Replaced non-frozen installs with `pnpm install --frozen-lockfile`.
- Added a separate blocking production-build job with CI-only compile-time values and no database credentials. This validates compilation, route generation, and prerender behavior while avoiding production secret exposure or database access from pull-request CI. Production environment correctness remains controlled by deployment secrets and post-deploy/runtime smoke checks rather than untrusted PR jobs.
- Added high/critical `pnpm audit` enforcement and GitHub dependency review for manifest and lockfile changes.
- Enabled Dependabot security alerts and scheduled dependency updates.
- Resolved Dependabot alert #27 by forcing vulnerable transitive PostCSS paths to patched PostCSS `8.5.15`.
- Resolved the pull-request security-audit failures by upgrading Jest and jsdom parents to `jest@30.4.2`, `jest-environment-jsdom@30.4.1`, and `@types/jest@30.0.0`; by patching the analyzer's transitive `ws` path to `7.5.11`; and by patching the Next/styled-jsx `@babel/core` path to `7.29.6`.
- Added a static database contract test that reconciles production-referenced tables and all application RPC names/arguments against generated Supabase types.
- Added release-critical tests for API authorization, matching transitions, and deadline enforcement.
- Added workflow timeouts, least-privilege permissions, and cancellation of superseded pull-request runs.

**Repository updates:**

- `.github/workflows/pull-request.yaml`
- `.github/dependabot.yml`
- `package.json`
- `pnpm-lock.yaml`
- `jest@30.4.2`, `jest-environment-jsdom@30.4.1`, and `@types/jest@30.0.0`
- `pnpm` overrides for `postcss@8.5.15`, `@babel/core@7.29.6`, and `webpack-bundle-analyzer > ws@7.5.11`
- `src/__tests__/databaseContract.test.ts`
- API authorization, matching-transition, and deadline-enforcement test files

**Supporting documentation:** `documentation/DATABASE_SOURCE_OF_TRUTH_AUDIT.sql` contains the read-only database evidence query set used to compare production metadata with generated application types. Production database structures and data were unchanged.

**Verification evidence:**

- `pnpm install --frozen-lockfile` - passed.
- `pnpm why postcss --recursive` - all application and Next.js paths resolve to PostCSS `8.5.15`; vulnerable PostCSS `8.4.31` is absent from `pnpm-lock.yaml`.
- `pnpm why ws form-data --recursive` - `ws` resolves to patched `7.5.11` for the analyzer and patched `8.21.0` for jsdom; `form-data` is no longer present in the jsdom dependency path.
- `pnpm audit --prod --audit-level low` - passed with no known production dependency vulnerabilities.
- `pnpm audit:security` - passed the high-severity gate; only three moderate development-dependency advisories remain below the configured blocking threshold.
- `pnpm test:database-contract` - passed; 1 suite and 2 tests confirmed production-referenced public tables and all application RPC contracts matched generated database types.
- `pnpm type-check` - passed.
- `pnpm lint` - passed with no warnings or errors.
- `pnpm knip` - passed.
- `pnpm knip:production` - passed.
- `pnpm test:ci --passWithNoTests --runInBand` - passed; 27 suites and 239 tests.
- `pnpm build` - passed; 48 route entries generated.
- Built-server smoke checks passed for public access, protected-page redirects, and `401` responses from protected Results, Admin, flight, match-request, and match-cancellation endpoints.

## Issue #12 - Unused or Stale Components

**Audit concern:** The repository contained unused or stale components, demo endpoints, commented-out executable blocks, unused providers, and unused dependencies. TypeScript did not enforce unused local or parameter checks.

**Status:** Completed

**Summary:** Stale production code was removed, intentionally disabled features were documented or feature-flagged, unused checks are enforced by TypeScript and Knip, and CI now prevents unused production code from accumulating.

**Remediation completed:**

- Removed stale components, UI primitives, MSW scaffolding, test utilities, an unused image helper, an unreferenced public asset, and unused React Query infrastructure.
- Removed demo or duplicate endpoints at `/api/message`, `/api/admin/users`, and `/api/auth/callback`; `/auth/callback` remains the production OAuth callback.
- Removed unused imports, locals, parameters, props, helpers, exports, dependencies, and abandoned calculations.
- Removed executable code preserved only in comments.
- Moved outgoing match requests behind `NEXT_PUBLIC_ENABLE_MATCH_REQUESTS` and documented other intentionally disabled features.
- Removed unused direct dependency declarations including unused Radix packages, React Query/devtools, `class-variance-authority`, MSW, and `undici`.
- Removed the unused global React Query provider while verifying retained providers have active consumers.
- Enabled `noUnusedLocals` and `noUnusedParameters`.
- Added `pnpm knip` and `pnpm knip:production` and included unused-code checks in pull-request CI.

**Repository updates:**

- `tsconfig.json`
- `package.json`
- `pnpm-lock.yaml`
- `knip.json`
- `knip.production.json`
- `.github/workflows/pull-request.yaml`
- Removed stale app, component, asset, provider, dependency, and test files as shown in the remediation branch diff.
- `documentation/KNIP.md`
- `documentation/FEATURE_STATUS.md`
- `documentation/ENABLE_MATCH_REQUESTS.md`

**Supporting documentation:**

- `documentation/KNIP.md`
- `documentation/FEATURE_STATUS.md`
- `documentation/ENABLE_MATCH_REQUESTS.md`
- Updated platform, onboarding, and operations documentation to remove stale references.

**Verification evidence:**

- `pnpm type-check` - passed with zero unused-local or unused-parameter errors.
- `pnpm knip` - passed with zero findings.
- `pnpm knip:production` - passed with zero findings.
- `pnpm lint` - passed.
- `pnpm test -- --runInBand` - passed.
- `pnpm build` - passed.
- Critical unauthenticated route smoke tests passed for authentication, profile, flight forms, Results, Unmatched, ASPC, and Admin access guards.

## Repository-Level Verification Summary

The following commands were used during the frontend remediation work as supporting release evidence:

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm knip
pnpm knip:production
pnpm test -- --runInBand
pnpm test:ci --passWithNoTests --runInBand
pnpm test:database-contract
pnpm audit --prod --audit-level moderate
pnpm audit:security
pnpm build
```

The latest recorded full frontend verification passed type checking, linting, unused-code scans, unit/integration tests, security audit checks, database contract checks, production build, and route smoke tests. Production database data, schemas, policies, and functions were not modified unless explicitly noted in the issue-specific repository updates above.
