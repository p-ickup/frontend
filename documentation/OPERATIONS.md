# Operations runbook

Recurring tasks for break prep, schema sync, emails, and delay notifications. For first-time setup see [CODEBASE_ONBOARDING.md](./CODEBASE_ONBOARDING.md).

---

## Regenerate Supabase TypeScript types

Output file: [`src/lib/database.types.ts`](../src/lib/database.types.ts)

One-time setup (CLI is already in `devDependencies`):

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref>
```

Regenerate after schema changes:

```bash
pnpm exec supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

If the project is not linked, use `--project-id <ref>` instead of `--linked`. See also [SCHEMA.md](./SCHEMA.md).

---

## Prepare frontend for departures / arrivals

Run this checklist before each break (Thanksgiving, winter, spring, summer, etc.).

| Step | File | What to change |
|------|------|----------------|
| Subsidized travel dates | [`src/config/subsidyConfig.ts`](../src/config/subsidyConfig.ts) | Add `MM-DD` entries to `COVERED_DATES_OUTBOUND` and/or `COVERED_DATES_INBOUND` |
| Deadlines + edit windows | [`src/utils/flightValidation.ts`](../src/utils/flightValidation.ts) | Extend `SERVICE_PERIODS`: buffered `start`/`end` (~3 days beyond subsidized dates), PST `deadline` (`YYYY-MM-DDTHH:MM:SS-08:00`), human-readable `name` (e.g. “Summer Break”). Powers `isFlightPastDeadline` / `canEditFlight` |
| In-form ASPC messaging | [`src/components/forms/FlightForm.tsx`](../src/components/forms/FlightForm.tsx) | In `checkASPCSubsidyEligibility`, append windows to `operationalPeriods` with `type: 'departure'` (campus → airport) or `'return'` (airport → campus) |
| Optional deadline banner | `FlightForm.tsx` | Re-enable the “Service Period Deadlines” banner and add a bullet matching the new `SERVICE_PERIODS` entry |
| Optional public copy | [`src/app/aspc-policy/page.tsx`](../src/app/aspc-policy/page.tsx) and other ASPC info pages | Align published dates with what you coded |

**Buffer rationale:** Service periods use a buffer beyond subsidized dates so riders who submit slightly outside covered dates still fall in the correct period and share the same request deadline / edit eligibility.

**Backend sync:** `subsidyConfig.ts` notes keeping dates in sync with backend `config.py` if the ML/matching service uses the same rules.

---

## Send batch emails (admin)

Use the **Admin Dashboard** ([`/admin`](../src/app/admin/page.tsx), [`AdminDashboard.tsx`](../src/components/admin/AdminDashboard.tsx)):

- Separate buttons for **matched** vs **unmatched** emails.
- Routes call edge functions `send-all-match-emails-batch` and `send-unmatched-emails-batch` (see [SUPABASE.md](./SUPABASE.md)).

You can change the edge functions to only send emails when the matches are manually verified. Right now, this functionality is turned off. Its purpose is for testing or if you only want to send a specific subset of emails.
**Selective matched sends:** Set `Matches.is_verified = true` only for groups you want emailed. The batch match edge function should filter on `is_verified = true` and `email_sent = false` — that filter may be commented out in the edge function source; look for the labeled block and enable it when doing testing email sends. See [BATCH_EMAIL_LOGIC.md](./BATCH_EMAIL_LOGIC.md).

**Note:** Admin group edits (voucher, subsidy, vehicle type) reset `is_verified` to `false` in [`GroupsManagement.tsx`](../src/components/admin/GroupsManagement.tsx), so re-verify groups before sending.

---

## Enable auto delay notification emails

Supabase Dashboard → **Integrations** → **Cron** → enable job **`delays-sweep-20`**.

[Cron jobs](https://supabase.com/dashboard/project/zgunhxopkgbksfoxthpn/integrations/cron/jobs)
