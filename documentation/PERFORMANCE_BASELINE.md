# Issue #9 Performance Evidence

Captured June 13, 2026 from baseline commit `55b1ada0e5a31326c3d4bd467dabfd199c26e32c`.

## Admin Groups Mutation Responsiveness

Before remediation, removing a rider waited for separate browser requests to delete the match, update flight status, update remaining group metadata, and write and refresh the changelog before visible state settled. During that interval the action could appear unresponsive.

After remediation, the group and unmatched lists update immediately. The rider displays a saving indicator and cannot be dragged, edited, or reassigned until persistence finishes. Moving a rider to unmatched, the corral, or another group uses one protected browser request; the server performs the required record, metadata, confirmation, and audit work. Successful rider edits and group creation also patch local state without a full snapshot reload. Ride and user/flight scope checks remain required before execution. Failure restores prior local state and triggers authoritative reconciliation. Mutations do not reload changelog or pending-change data while those panels are closed.

Automated evidence verifies one-command browser contracts for the common move paths, complete removal persistence and changelog behavior, out-of-scope rejection, successful local-state updates, and pending-state action blocking. No production latency value is claimed without authenticated production telemetry.

### Authenticated Mutation Timing

On June 13, 2026, Xavier M's `AA 123` flight was removed from Group #736 and restored to the same group through the authenticated local production build. Timing began with the mutation click and ended when the corresponding rider state became visible. The original four-rider group was restored after measurement.

| Mutation | Visible completion |
| --- | ---: |
| Remove from Group #736 to Unmatched | **404 ms** |
| Move from Unmatched into the Corral | **637 ms** |
| Re-add from the Corral to Group #736 | **703 ms** |
| Complete re-add mutation work | **1.34 s** |

The 1.34-second re-add total combines the required Unmatched-to-Corral and Corral-to-group mutations and excludes administrator navigation and selection time. These measurements represent immediate user-visible state on a warm local production build; server persistence remains protected by the saving state, and failures trigger authoritative reconciliation.

## Method

The request baseline was derived from the mounted component and server-layout call graph. Counts include Supabase authentication and `Users` profile requests made while opening a route, but exclude page-specific data requests. Automated provider tests preserve the post-change counts.

The baseline preserves request counts, query breadth, and serial dependencies from the code path. Payload figures below come from a labeled, reproducible representative fixture. Authenticated time-to-content measurements were subsequently captured against the local production build and are reported separately from public-network production latency.

## Authenticated Timing Capture

The critical read endpoints emit `Server-Timing` for application processing duration and `X-Response-Bytes` for the exact serialized response size. These headers are available on Results, Unmatched, the Admin summary, and the Admin Groups snapshot. They allow timing evidence to be collected against a production-like authenticated dataset without recording response contents.

For each route, open the browser network panel with cache disabled, perform one warm-up navigation, and then record three full reloads. Report the median values for document time-to-first-byte, primary API `Server-Timing`, primary API `X-Response-Bytes`, and time until the principal content or loading state is visible. Admin Groups should be measured with its default date window and first 200-record page. Deferred changelog, pending-change, cancellation, and no-show requests should not appear before their panels or actions are opened.

On June 13, 2026, the application was built with `next build`, served with `next start` on localhost, and measured through an authenticated account containing matches, unmatched flights, and scoped Admin access. After one warm-up navigation, each route was fully reloaded three times. The endpoint was considered visible when its principal page heading appeared. Browser cache remained enabled, so these values represent warm repeat navigation rather than cold-cache or public-network performance.

| Route | Three authenticated runs | Median time to principal content | Primary telemetry response |
| --- | ---: | ---: | --- |
| Results | 826 ms, 710 ms, 692 ms | **710 ms** | Server-rendered `/results`; `/api/results` on later refresh |
| Unmatched | 646 ms, 640 ms, 915 ms | **646 ms** | Server-rendered `/unmatched`; `/api/unmatched/options` on later refresh |
| Admin | 672 ms, 683 ms, 666 ms | **672 ms** | `/api/admin/dashboard-summary` |
| Admin Groups | 775 ms, 818 ms, 790 ms | **790 ms** | `/api/admin/groups/snapshot` |

All four principal views became visible in under one second at the median. Admin Groups, the heaviest audited workflow, reached visible content in 790 ms while loading a bounded first page. These values demonstrate the remediated local application path but do not include internet latency, remote production compute variance, or cold-cache startup. The `Server-Timing` and `X-Response-Bytes` headers remain available for a Network-panel capture in staging or production.

## Baseline Auth and Profile Path

| Route        |                                                Identity/profile requests per initial load | Initial content dependency                                                                                                                                              | Payload concern                                           |
| ------------ | ----------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Results      | At least 6, plus 2 for every mounted `MatchCard` and 2 for every mounted `CommentSection` | Middleware auth -> page `getUser()` -> `/api/results` -> sequential readiness writes -> render                                                                          | Full `Matches` and related `Flights` rows                 |
| Unmatched    |                                                                                At least 6 | Middleware auth -> page `getUser()` -> unmatched API -> render                                                                                                          | Full own and candidate flight rows                        |
| Admin        |                                                                                         9 | Middleware auth -> server admin auth/profile -> client profile -> algorithm status -> schedule -> flights -> matches -> render                                          | Multiple summary datasets assembled client-side           |
| Admin Groups |                                                                                         9 | Middleware auth -> server admin auth/profile -> algorithm window -> flights -> user batches -> admin-scope profile -> matches -> changelog -> pending changes -> render | Paged Flights and Matches plus user and changelog records |

The fixed lower bound on Results and Unmatched came from middleware, independent Header and page `useAuth()` instances, Header role lookup, and avatar lookups. Results added further authentication and avatar requests for each nested component using `useAuth()`.

## Remediated Auth and Profile Path

| Route        | Identity/profile requests per initial load | Change                                                                         |
| ------------ | -----------------------------------------: | ------------------------------------------------------------------------------ |
| Results      |               3 server-side, 0 client-side | Server principal hydrates Header, page, cards, and comments                    |
| Unmatched    |               3 server-side, 0 client-side | Server principal hydrates Header and page                                      |
| Admin        |               3 server-side, 0 client-side | Admin layout performs the authorization/profile load once; dashboard reuses it |
| Admin Groups |               3 server-side, 0 client-side | Admin layout profile supplies user identity and admin scope                    |

The three server-side operations are the protected-route middleware validation followed by one page-layout user validation and one minimal profile read. They complete before hydration and replace an unbounded number of client requests. Public routes use one provider initialization and one profile read for an authenticated user.

## Query Contracts and Results Rendering

| Workflow             | Read contract                                                                                         | Page-load change                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Results              | 10 Match fields, 3 related Flight fields, and 6 related User fields                                   | Match content waits only for the read; readiness changed from per-ride writes to one background batch |
| Unmatched            | 5 own-flight fields; 8 candidate-flight fields plus 3 User fields; grouped options use the same shape | Full Flight and User rows are no longer returned                                                      |
| Profile completeness | 5 required profile fields                                                                             | Role, scope, avatar, and unrelated profile fields are excluded                                        |
| Admin read models    | Explicit summary, group, and rider DTOs                                                               | Undeclared properties are removed before use; server aggregation is documented below                  |

Results now performs zero blocking readiness writes before content is displayed. For `N` eligible rides, the initial page-load write pattern changed from `N` sequential requests to one deduplicated background request. The server validates membership for the complete batch before writing and updates only rows whose `group_ready_at` is still null.

## Main Admin Dashboard

| Admin summary path       | Before                                                                                         | After                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Browser requests         | 5 direct Supabase reads: last status, schedule, scoped Flights, Matches, and unmatched count   | 1 admin-protected summary request                                                                               |
| Server/database sequence | Browser serialized status -> schedule -> Flights -> Matches; unmatched count loaded separately | Status, schedule, and unmatched count start together; scoped Flights -> Matches retains its required dependency |
| Browser payload          | Raw status, Flight, User-school, and Match rows used for client aggregation                    | 9 displayed scalar/string values in `AdminSummaryDto`                                                           |
| Reports on mount         | 0                                                                                              | 0; cancellation and no-show reports remain button-triggered and date-filtered                                   |

This change moves trust and aggregation to the authenticated server boundary and reduces the Admin dashboard's summary request count without changing database policies or report behavior.

## Admin Groups Dashboard

| Admin Groups path        | Before                                                                                            | After                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primary browser requests | Direct status, Flights, user, admin-scope, Matches, changelog, and pending-change reads           | 1 admin-protected snapshot request                                                                                                |
| Record bounds            | Flights and Matches paged to exhaustion                                                           | Default seven-days-back through one-month-forward window; 200 Flight records per page                                             |
| Primary sequence         | Status -> Flights -> sequential user batches -> Matches -> changelog -> pending changes -> render | Group snapshot and algorithm status run concurrently; primary dashboard renders before secondary panels                           |
| Group completeness       | All records loaded before groups were assembled                                                   | Complete membership is hydrated only for groups touched by the selected page; one in-window anchor prevents cross-page duplicates |
| Secondary panels         | Changelog and pending changes block initial rendering                                             | Changelog loads on expansion at 100 entries per page; pending changes load only when the Changes tab opens                        |
| Loading state            | Plain full-page loading text                                                                      | Existing unmatched-page loading treatment, followed by nonblocking refresh and pagination states                                  |

User lookup batches now start concurrently. The endpoint continues to use the authenticated Supabase client and existing RLS/admin scope; no database policy, schema, or RPC changes were required.

## Database Read-Model Evaluation

The optimized implementation was measured before considering any database object. The reproducible fixture represents one full 200-flight page containing 50 four-rider groups and excludes changelog/pending data because those panels no longer load initially.

| Measurement                            |                                                               Before |                                          After |
| -------------------------------------- | -------------------------------------------------------------------: | ---------------------------------------------: |
| Primary Admin Groups browser requests  | At least 5 direct data reads, plus user batches and secondary panels |                   1 protected snapshot request |
| Representative primary browser payload |                         Approximately 139.1 KiB of raw selected rows |     Approximately 70.5 KiB serialized response |
| Server reads                           |                      Client performed the aggregation reads directly |      6 narrow reads including algorithm status |
| Server-selected rows                   |                               Unbounded by a default date/page limit | 801 rows for the representative 200-rider page |
| Server-selected payload                |                 Not applicable to the former client aggregation path |                        Approximately 145.0 KiB |

The optimized browser payload is approximately 49% smaller for the representative page, before accounting for changelog and pending-change data that previously blocked initial rendering. Existing product rules cap groups at six riders, so related hydration is bounded by the 200-flight page and touched group membership. The measured transfer and processing volume did not justify the operational and audit cost of adding a view or read-only RPC. No view, RPC, index, schema, or policy change was proposed or applied.

Production-observed values were unavailable because the local browser had no authenticated production-like dataset. Critical read endpoints now expose application duration through `Server-Timing` and serialized response size through `X-Response-Bytes`, allowing the same authenticated workflow to be measured in a production-like environment without recording response content. The figures above remain reproducible fixture measurements and are labeled as such rather than presented as production telemetry.

## Final Request and Behavior Comparison

| Workflow     | Before                                                                                               | After                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Results      | Duplicate auth/profile initialization; read followed by sequential per-ride writes before rendering  | Server-loaded initial DTO; one deduplicated background write after content renders            |
| Unmatched    | Duplicate auth/profile initialization and broad Flight/User rows                                     | Server-loaded initial DTO with explicit Flight/User fields                                    |
| Admin        | Five direct summary reads assembled in the browser                                                   | One protected summary request returning nine displayed values                                 |
| Admin Groups | Serial status, unbounded Flights/Matches, user batches, changelog, and pending changes before render | One bounded primary request; status runs concurrently; secondary panels load only when opened |

## Reproducible Checks

- `src/providers/AuthProvider.test.tsx` mounts multiple consumers and asserts one `getUser()` call and one `Users` query.
- The server-hydration test asserts zero client `getUser()` or `Users` queries.
- Session-change coverage confirms sign-in, sign-out, and immediate avatar updates still propagate to every consumer.
- Profile-refresh coverage confirms a saved profile updates shared school, role, admin scope, and avatar state without a full-page reload.
- Contract tests assert exact Results, Unmatched, profile, admin-summary, group, and rider keys and verify injected fields are removed.
- Query coverage rejects literal `select('*')` and empty `.select()` calls throughout production TypeScript.
- Results tests prove match content renders while the background batch is unresolved and remains visible when that request fails.
- Server-command tests prove ride IDs are deduplicated, membership is checked before writes, existing readiness timestamps are preserved, and null-only updates are used.
- Admin summary tests prove independent reads start before the last-run dependency resolves, response keys are restricted to displayed values, and broad selections are absent.
- Admin component tests prove initial rendering performs no browser Supabase reads and cancellation/no-show queries occur only after their buttons are clicked with date filters.
- Admin Groups tests prove the date window and page range are applied before related hydration, complete groups do not repeat across Flight pages, user batches start concurrently, and changelog/pending reads remain outside initial rendering.
- API authorization coverage requires the Admin Groups snapshot route to use `withAdminRoute`; production-build route smoke testing confirmed an unauthenticated request returns `401 Unauthorized`.
- Admin Groups route tests enforce exact response keys, valid dates, a maximum 366-day window, positive page values, and page sizes no larger than 200.
- The representative measurement test keeps a 200-rider page to five group-snapshot reads, 800 selected rows, and less than 80 KiB of serialized snapshot data; the endpoint adds one concurrent algorithm-status read.
- Response telemetry coverage verifies the four critical read paths can report server duration and exact serialized payload bytes during an authenticated capture.

## Final Verification

- `pnpm type-check`, `pnpm lint`, `pnpm knip`, and `pnpm knip:production` passed.
- `pnpm exec jest --ci --runInBand` passed 22 suites and 140 tests.
- `pnpm build` generated 48 application route entries, including the protected Admin summary, groups snapshot/command, report, lookup, secondary-panel, and export endpoints.
- Production-build route smoke tests confirmed protected pages preserve their return destinations and the Admin Groups snapshot and command endpoints return `401 Unauthorized` without a session. Local browser smoke testing reported no console errors.
