# Match request feature flag

Outgoing individual match requests are implemented but disabled by default. The
UI is controlled by:

```bash
NEXT_PUBLIC_ENABLE_MATCH_REQUESTS=true
```

When the flag is absent or set to any other value, the unmatched page keeps the
current contact-and-coordinate workflow and does not render a send-request
button. Incoming request handling remains active at `/MatchRequestsPage`.

## Before enabling

Confirm the `MatchRequests` row-level security policies in Supabase allow only:

- participants to read or delete a request;
- the authenticated sender to insert a request using their own `sender_id`;
- the authenticated receiver to accept or reject a request.

The send route validates the authenticated sender and flight identifiers before
writing. Enabling the flag should still be tested with three normal users:

1. User A sends a request to user B.
2. User B can view and accept or reject the incoming request.
3. User C cannot read, update, or delete the A-B request.
4. A user with no eligible unmatched flight sees the disabled eligibility state.

The removed group-join request interface is not controlled by this flag. It was
an obsolete duplicate of the current group contact-and-coordinate workflow.
