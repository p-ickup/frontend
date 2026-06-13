# Intentionally disabled product features

This file records product behavior that is intentionally unavailable so it does
not return as commented-out executable code.

| Feature                            | Current status                                                                                                                        | Re-enable condition                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Individual outgoing match requests | Implemented behind `NEXT_PUBLIC_ENABLE_MATCH_REQUESTS`; disabled by default                                                           | Confirm production RLS and complete the three-user test in `ENABLE_MATCH_REQUESTS.md` |
| Group join requests                | Removed; the live unmatched-groups view directs riders to contact group members                                                       | New product approval and a separately designed flow                                   |
| Self-service return trips          | Data model, matching, admin, and email paths support airport-to-campus trips; the Summer Break form deliberately disables “To Campus” | ASPC publishes an inbound service period and product approves form availability       |
| Profile photo uploads              | Existing OAuth/profile photo URLs are preserved and displayed; direct uploads were removed                                            | Approve storage bucket policy, file validation, privacy, and deletion behavior        |
| Standalone deadline banner         | Deadline enforcement remains active through `SERVICE_PERIODS`; duplicated hard-coded banner dates were removed                        | Product requests a summary UI sourced directly from `SERVICE_PERIODS`                 |

Git history remains the source for removed implementations. New work should be
implemented as active code behind a feature flag or linked to an external issue,
not stored in comments.
