# Knip configuration

Run both scans before merging production-code changes:

```bash
pnpm knip
pnpm knip:production
```

`pnpm knip` scans the complete repository. `pnpm knip:production` excludes
development-only reachability and uses `knip.production.json`.

## Exceptions

The exception list is intentionally small. Additions require a reason here and
manual verification that the item is framework-discovered, generated, or
operationally invoked.

| Exception                   | Scope                | Reason                                                                                                                                                                      |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/database.types.ts` | Both scans           | Generated Supabase schema declarations expose types beyond the subset currently imported by the frontend. The file is regenerated from the database and is not hand-pruned. |
| `server-only`               | Both scans           | Next.js marker package imported for its build-time boundary side effect; it does not expose an application API for Knip to trace.                                           |
| `supabase`                  | Both scans           | Supabase CLI is invoked by maintainers and CI/operations outside the application import graph.                                                                              |
| `jest.setup.ts`             | Production scan only | Jest setup is a development/test entry point and is deliberately absent from the production graph.                                                                          |
| `tailwindcss-animate`       | Production scan only | Tailwind loads the plugin through `tailwind.config.ts`; it is configuration-discovered rather than imported by production application modules.                              |

Knip findings are candidates, not deletion instructions. Next.js entries,
public assets, scripts, providers with document-level effects, barrel exports,
and dynamically referenced files must be checked manually before removal.
