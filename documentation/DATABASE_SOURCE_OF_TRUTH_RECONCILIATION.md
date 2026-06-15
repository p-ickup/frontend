# Database Source-of-Truth Reconciliation

## Safety boundary

This review uses repository files and previously exported read-only evidence only. No production database connection, migration, SQL execution, link, push, reset, policy change, RPC replacement, or grant change was performed.

`supabase db reset` is not enabled in CI. It will remain disabled until a production-equivalent schema history has been reviewed and approved. If later approved, reset will target only an isolated disposable CI container with no production credentials.

## Evidence reviewed

Read-only production metadata exports were reviewed for tables, columns, constraints, indexes, sequences, functions, function grants, table grants, RLS and storage policies, triggers, and extensions.

- Production contains 13 public tables and 154 columns. Table names, column names, data types, and nullability match `src/lib/database.types.ts`.
- Production contains 36 public functions. The generated types contain the 33 callable functions; the three omitted functions are trigger handlers and are not application RPCs.
- Production code references 10 public tables and calls 12 RPCs. All referenced table names and all production RPC names and argument names match `src/lib/database.types.ts`; CI discovers and verifies this contract across the full production TypeScript tree.
- Current production RPCs use `Flights.matching_status`. Several historical SQL files still reference the legacy `Flights.matched` field and therefore are retained as history, not treated as replayable production definitions.
- The production migration-history query returned no recorded rows. The current state is authoritative for this compatibility review, but the repository cannot safely claim clean migration replay.

| RPC group                                 | Application/type contract | Current migration definition                                              |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| Match request acceptance and cancellation | Present                   | Present, but checked-in definitions use legacy `Flights.matched` behavior |
| Ready-status reporting                    | Present                   | Present                                                                   |
| Admin group create/delete                 | Present                   | Present, but checked-in definitions use legacy `Flights.matched` behavior |
| ASPC delay commands                       | Present                   | Present, but checked-in definitions use legacy `Flights.matched` behavior |
| Own-flight update/delete transactions     | Present                   | Missing from `supabase-migrations/`                                       |

The migration directory is not a complete schema history:

- It contains six function-focused SQL files and no baseline table, constraint, index, policy, trigger, helper-function, storage, or extension migrations.
- `ChangeLog.change_batch_id` and `Matches` override columns appear in generated types/current code, but their historical migration files were removed from the tracked migration directory.
- `Flights.matching_status` appears in generated types and production code, but no tracked migration creates the column or contains the documented RPC cutover from `matched` to `matching_status`.
- Remediation documentation references later own-flight and matching-status migrations that are not present in the current repository.
- Current production policies, grants, triggers, and extensions are preserved in the read-only audit evidence; no migration file was inferred or generated from those results.

## Decision

The repository cannot yet be treated as the database source of truth, and its current SQL files must not be replayed as though they can recreate production. Creating a standard Supabase migration layout or enabling clean-database reset/lint/type-generation CI before reconciliation would provide false assurance.

Production database changes are not required for this remediation and are intentionally out of scope. Existing tables, data, RPCs, triggers, grants, RLS policies, indexes, and storage policies remain unchanged. CI assurance is limited to the committed generated contract and reviewed production evidence until a complete migration history exists.

## Ongoing safety boundary

`documentation/DATABASE_SOURCE_OF_TRUTH_AUDIT.sql` remains the reproducible, read-only metadata export for future comparisons. Any proposed baseline migration, RPC definition, grant, RLS policy, trigger, index, or schema change requires separate review and explicit approval.

An isolated migration-replay CI job is deferred rather than built from incomplete history. It may be reconsidered only after explicit approval and a complete reviewed migration baseline. Production credentials and project links will never be available to pull-request CI.
