# PICKUP documentation

Engineering docs for the frontend repo. Start here when onboarding.

| Doc                                                                                        | Purpose                                                          |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [CODEBASE_ONBOARDING.md](./CODEBASE_ONBOARDING.md)                                         | Local setup, repo layout, env vars, where to change things       |
| [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md)                                             | Product flow, student vs admin paths, data model at a glance     |
| [SCHEMA.md](./SCHEMA.md)                                                                   | Tables, columns, relationships                                   |
| [SUPABASE.md](./SUPABASE.md)                                                               | Database RPCs, edge functions, migrations, syncing from Supabase |
| [OPERATIONS.md](./OPERATIONS.md)                                                           | Break prep, types sync, batch emails, delay cron                 |
| [BATCH_EMAIL_LOGIC.md](./BATCH_EMAIL_LOGIC.md)                                             | Match email variants (subsidized / direction)                    |
| [ENABLE_MATCH_REQUESTS.md](./ENABLE_MATCH_REQUESTS.md)                                     | Outgoing match-request feature flag + RLS test notes             |
| [FEATURE_STATUS.md](./FEATURE_STATUS.md)                                                   | Intentionally disabled product features and re-enable conditions |
| [KNIP.md](./KNIP.md)                                                                       | Dead-code commands, review policy, and documented exceptions     |
| [DATABASE_SOURCE_OF_TRUTH_RECONCILIATION.md](./DATABASE_SOURCE_OF_TRUTH_RECONCILIATION.md) | Production schema/RPC reconciliation and CI safety boundary      |
| [DATABASE_SOURCE_OF_TRUTH_AUDIT.sql](./DATABASE_SOURCE_OF_TRUTH_AUDIT.sql)                 | Read-only production metadata export for database reconciliation |

Other: [DEPENDENCY_FIX_GUIDE.md](./DEPENDENCY_FIX_GUIDE.md).
RPC = Remote Procedure Call.
