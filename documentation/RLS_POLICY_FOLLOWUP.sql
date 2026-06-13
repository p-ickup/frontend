-- Read-only follow-up for remediation issue #10.
-- Export/share every result set. This script does not change the database.

-- 1. RLS and grants for tables accessed directly by browser clients.
with browser_tables(table_name) as (
  values
    ('Users'),
    ('Flights'),
    ('Matches'),
    ('AlgorithmStatus'),
    ('ChangeLog'),
    ('match_cancellations'),
    ('legal_acceptances')
)
select
  bt.table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT') as anon_select,
  has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'INSERT') as anon_insert,
  has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'UPDATE') as anon_update,
  has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'DELETE') as anon_delete,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'DELETE') as authenticated_delete
from browser_tables bt
left join pg_class c on c.relname = bt.table_name and c.relkind in ('r', 'p')
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
order by bt.table_name;

-- 2. Exact policies for those browser-accessed tables.
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
where schemaname = 'public'
  and tablename in (
    'Users',
    'Flights',
    'Matches',
    'AlgorithmStatus',
    'ChangeLog',
    'match_cancellations',
    'legal_acceptances'
  )
order by tablename, cmd, policyname;

-- 3. Exact storage policies, including command and WITH CHECK expressions.
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
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%profile_picture%'
    or coalesce(with_check, '') ilike '%profile_picture%'
  )
order by cmd, policyname;

-- 4. Definitions and grants for active, legacy, or unusually configured RPCs.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'update_own_flight_tx',
    'delete_own_flight_tx',
    'update_own_flight',
    'delete_own_flight',
    'reject_match_request',
    'report_delay',
    'restore_deleted_match'
  )
order by p.proname, arguments;
