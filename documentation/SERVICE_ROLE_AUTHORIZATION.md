# Service-role authorization audit

The Supabase service-role client bypasses Row Level Security. Each use must therefore derive the acting user from a validated server session and enforce ownership, membership, or admin scope before returning or mutating data.

| Service-role use         | Authorization preserved                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth profile bootstrap  | Runs only after `exchangeCodeForSession`; reads and upserts `Users` using the returned `user.id`. No caller-supplied user ID is accepted.                                                              |
| Create profile           | Authenticated API wrapper supplies `user.id`; `saveOwnProfile` always writes that ID.                                                                                                                  |
| Create flight            | Authenticated API wrapper supplies `user.id`; `createOwnFlight` forces `Flights.user_id` to that ID and validates profile completeness.                                                                |
| Unmatched options        | Authenticated API wrapper supplies `user.id`; the command loads the caller's eligible flights and excludes that user from peer results. No user ID parameter is accepted from the request.             |
| Incoming match requests  | Authenticated API wrapper supplies `user.id`; results are filtered by `receiver_id = user.id`.                                                                                                         |
| Send match request       | Authenticated API wrapper supplies `user.id`; the command verifies the sender flight belongs to that user and the receiver flight belongs to the requested receiver.                                   |
| Mark group ready         | Authenticated API wrapper supplies `user.id`; `assertRideMembership` verifies membership before updating the group.                                                                                    |
| ASPC delay reads/actions | Authenticated API wrapper supplies `user.id`; reads filter by ride/user, commands verify the current ride match, and service-role-only RPCs constrain updates by `p_user_id` plus current ride/flight. |
| Admin group commands     | Admin API wrapper verifies `admin`/`super_admin`; every action applies the relevant user, flight, ride, change-log, or multi-record admin-scope assertion before service-role work.                    |

The email proxy routes do not instantiate a service-role client. They require the admin wrapper and invoke the existing Supabase edge endpoints with the public anon key.

## Preserved boundaries

- Middleware establishes authentication for protected pages only.
- API wrappers establish authenticated or admin principals.
- Student commands enforce ownership and ride/request membership.
- `adminScope.ts` enforces school scope before admin service-role mutations.
- Session-bound RPCs continue to use `auth.uid()` where required.
- Service-role-only ASPC delay RPCs accept only the server-derived user ID and verify matching ride/flight rows.

No service-role key, RLS policy, RPC grant, migration, or database object was changed during this audit.
