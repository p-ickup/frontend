# Acquisition-Focused Code Audit

Perspective: third-party acquirer review by PM + senior SWE.  
Standard: prioritize overtly bad issues that can materially destroy product value, increase integration risk, or trigger diligence blockers.

## Executive Verdict

The product appears functional, but there are multiple **high-risk engineering and security decisions** that would reduce acquisition confidence.  
Largest value risk comes from: (1) trust boundaries in DB/API write paths, (2) privileged function hardening gaps, and (3) weak correctness controls around transactional workflows.

---

## Pain Points Ordered by Value Loss (Highest -> Lowest)

## 1) Data Integrity + Privilege Risk from Broad Write Surfaces
**Why this is overtly bad:** Core write paths accept broad payloads and pass them through with insufficient narrowing, which can allow unintended field mutation and silent corruption.

**Evidence**
- `src/lib/server/studentCommands.ts` (`createOwnFlight`, `updateOwnFlight`) uses broad payload spreading into writes.

**Value impact**
- Potential unauthorized state changes, hard-to-trace corruption, and compliance/security exposure.
- Directly affects user trust and increases incident cost.

---

## 2) Service-Role Overuse in User-Facing API Routes
**Why this is overtly bad:** Service-role clients are used across many route handlers. If route validation/auth has a bug, blast radius becomes “full DB authority”.

**Evidence**
- Multiple routes under `src/app/api/**` use `createServiceRoleClient()` from `src/lib/server/serviceRole.ts`.

**Value impact**
- One bug can become a broad data breach/mutation event.
- Significant diligence red flag for buyers.

---

## 3) SECURITY DEFINER Hardening Gaps (search_path + execution surface)
**Why this is overtly bad:** Many `SECURITY DEFINER` functions are callable and use `set search_path = public` patterns flagged by Supabase linting as mutable-risk posture.

**Evidence**
- `supabase-migrations/2026-04-29_cancel_own_match_for_update_fix.sql`
- `supabase-migrations/2026-04-29_accept_match_request_transaction.sql`
- `supabase-migrations/2026-04-29_report_ready_status_transaction.sql`
- `supabase-migrations/2026-04-29_admin_group_transaction_commands.sql`
- `supabase-migrations/2026-04-29_aspc_delay_transaction_commands.sql`

**Value impact**
- Elevated exploitability in privileged DB routines.
- Expensive post-incident remediation and audit burden.

---

## 4) Concurrency/Double-Assignment Risk in Group Creation Workflow
**Why this is overtly bad:** Group creation logic appears to update assignment state without clear row-locking/anti-race protections around candidate flights.

**Evidence**
- `supabase-migrations/2026-04-29_admin_group_transaction_commands.sql` (`create_group_records` flow: insert rides/matches, then update flights to matched).

**Value impact**
- Duplicate/invalid group states, support escalations, operational instability.
- Damages product reliability and dispatch quality.

---

## 5) Unsafe Trust Boundary on Caller-Supplied Identity in Privileged Functions
**Why this is overtly bad:** Some privileged workflows rely on `p_user_id` inputs as authority targets rather than deriving actor identity in-function.

**Evidence**
- `supabase-migrations/2026-04-29_aspc_delay_transaction_commands.sql` functions handling ASPC delay flows.

**Value impact**
- Identity spoofing potential if upstream controls fail.
- Weakens forensic confidence and governance controls.

---

## 6) Information Leakage Through API Error Details
**Why this is overtly bad:** Error helper paths expose internal details in responses, improving attacker feedback and increasing exploitability.

**Evidence**
- `src/lib/server/auth.ts` (`routeErrorJson`, `internalErrorJson`) patterns used by route handlers.

**Value impact**
- Better attacker reconnaissance, larger incident impact.

---

## 7) Admin Mail Trigger Auth Pattern Uses Public Key Context
**Why this is overtly bad:** Admin-triggered email routes authenticate downstream calls with anon-key style bearer pattern, which is brittle if function-side checks drift.

**Evidence**
- `src/app/api/admin/send-match-emails/route.ts`
- `src/app/api/admin/send-unmatched-emails/route.ts`

**Value impact**
- Privileged action boundary is weaker than expected for enterprise-grade controls.

---

## 8) Migration Permission Hygiene is Inconsistent
**Why this is overtly bad:** Replacement migration for the same function omits explicit grant/revoke posture seen in earlier migration.

**Evidence**
- With grants: `supabase-migrations/2026-04-29_cancel_own_match_transaction.sql`
- Without corresponding grant/revoke in fix: `supabase-migrations/2026-04-29_cancel_own_match_for_update_fix.sql`

**Value impact**
- Environment drift and deploy unpredictability.
- Higher rollback/incident risk during integration.

---

## 9) Low Test Coverage Relative to Workflow Criticality
**Why this is overtly bad:** Critical authz/transactional paths have sparse automated test coverage.

**Evidence**
- Limited test surface in `src` for high-risk domains.

**Value impact**
- Higher regression probability and slower release confidence.
- Raises integration cost for acquiring engineering teams.

---

## 10) Excessive Complexity Concentrated in Mega Components
**Why this is overtly bad:** Very large UI modules centralize business behavior and make safe change difficult.

**Evidence**
- `src/components/forms/FlightForm.tsx`
- `src/components/admin/groups-management/GroupsManagementModals.tsx`

**Value impact**
- High change-failure rate, slower onboarding, reduced feature velocity.

---

## 11) Security/Platform Hygiene Warnings Need Prompt Attention
**Why this is overtly bad:** Configuration-level warnings (password leak protection off, postgres patch lag) indicate avoidable baseline security debt.

**Evidence**
- Supabase linter/security output provided in review context.

**Value impact**
- Raises diligence friction and undermines maturity signal.

---

## Bottom Line for an Acquirer

This codebase has **real product value**, but current risk posture would likely trigger:
- price pressure (risk discount),
- remediation holdbacks,
- or a mandatory hardening plan pre-close.

Main reason: **security boundary design and transactional correctness are not yet at acquisition-grade reliability.**

