# PICKUP Frontend

Next.js app for managing pickup workflows, matching requests, and admin operations with Supabase.

## Stack

- Next.js
- Supabase (Auth + Database)
- Tailwind CSS
- React Query

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Run locally:
   ```bash
   pnpm dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `pnpm dev` - start local dev server
- `pnpm build` - build for production
- `pnpm start` - run production build
- `pnpm test` - run Jest tests
- `pnpm type-check` - TypeScript check

## Documentation

Start at [documentation/README.md](./documentation/README.md):

- [Codebase onboarding](./documentation/CODEBASE_ONBOARDING.md) — env, layout, first changes
- [Platform overview](./documentation/PLATFORM_OVERVIEW.md) — student/admin flows and architecture
- [Database schema](./documentation/SCHEMA.md) — tables and column definitions
- [Supabase](./documentation/SUPABASE.md) — RPCs, edge functions, syncing from Supabase
- [Operations runbook](./documentation/OPERATIONS.md) — break prep, types sync, emails, delay cron
