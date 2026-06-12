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
- Added type checking, both Knip scans, linting, tests, and production build checks to pull-request CI.

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
