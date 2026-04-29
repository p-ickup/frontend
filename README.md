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
