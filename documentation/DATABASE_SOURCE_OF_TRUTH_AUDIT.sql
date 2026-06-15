-- Read-only production metadata export for remediation issue #11.
-- This script contains SELECT statements only. It does not create, alter,
-- insert, update, delete, grant, revoke, reset, or execute application RPCs.
-- Run each numbered query in the Supabase SQL editor and export every result.

-- 1. Applied Supabase migration history.
select
  version,
  name,
  statements
from supabase_migrations.schema_migrations
order by version;

-- 2. Public tables and views.
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 3. Public table and view columns.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default,
  is_identity,
  identity_generation,
  is_generated,
  generation_expression
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 4. Primary keys, foreign keys, unique constraints, and checks.
select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

-- 5. Public indexes.
select
  tablename as table_name,
  indexname as index_name,
  indexdef as definition
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 6. Public enum values.
select
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- 7. Public sequences.
select
  sequence_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value,
  increment
from information_schema.sequences
where sequence_schema = 'public'
order by sequence_name;

-- 8. Complete public function/RPC definitions and security properties.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as return_type,
  pg_get_userbyid(p.proowner) as owner,
  (select language.lanname from pg_language language where language.oid = p.prolang) as language,
  p.provolatile as volatility,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  p.proacl as access_control_list,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, identity_arguments;

-- 9. Public table grants.
select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;

-- 10. Public RLS configuration and policies.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  permissive,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, cmd, policyname;

-- 11. Non-internal triggers on public tables.
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;

-- 12. Installed extensions used by the schema.
select
  extname as extension_name,
  extversion as version,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by extname;
