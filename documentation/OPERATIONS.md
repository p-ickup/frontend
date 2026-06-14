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
| ---- | ---- | -------------- |
| **All break dates, deadlines, directions** | [`src/config/servicePeriods.ts`](../src/config/servicePeriods.ts) | Add or edit period rows: `subsidized` outbound/inbound ranges, `buffered` window, `deadline` (ISO with correct PT offset), `allowedDirections`. Short breaks = one dual-direction row; long winter gap = separate outbound/return rows. |
| Airport mins + school | [`src/config/subsidyConfig.ts`](../src/config/subsidyConfig.ts) | `AIRPORT_MIN_RIDERS`, `ALLOWED_SCHOOL` only — covered date lists are derived automatically. |
| Optional deadline summary | [`FEATURE_STATUS.md`](./FEATURE_STATUS.md) | Any future banner must use `getBufferedPeriods()` from `servicePeriodHelpers.ts`. |

**Auto-updated consumers** (no manual edits needed after `servicePeriods.ts` changes):

- Flight form direction gating, deadline checks, ASPC warnings — [`FlightForm.tsx`](../src/components/forms/FlightForm.tsx)
- Admin subsidy/voucher logic — [`useSubsidyLogic.ts`](../src/hooks/useSubsidyLogic.ts) via derived `COVERED_DATES_*`
- Public policy page — [`aspc-policy/page.tsx`](../src/app/aspc-policy/page.tsx) shows the **last** period in the array (append new breaks at the end)

**Buffer rationale:** Buffered windows extend beyond subsidized dates so riders near the edge of a break share the same request deadline and edit eligibility. These dates are still unsubsidized but this allows students the opportunity to be possibly matched with others for that school break.

**Backend sync:** The ML batch service uses a separate `config.py` (different repo, batch-only). When breaks change, update `servicePeriods.ts` first, then align `config.py` manually (or add a JSON export script later).

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
