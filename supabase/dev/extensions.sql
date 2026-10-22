-- Local dev only: extensions the production schema depends on (loaded before dev/schema.sql).
-- pg_net backs the email-notification triggers; their URLs are rewritten to the local stack.
create extension if not exists pg_net;
