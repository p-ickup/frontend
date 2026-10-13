-- Local dev seed data. Runs after dev/schema.sql on `supabase start` (fresh volume) and on
-- `./start.sh db:reset`. Never applied to production.
--
-- Every account signs in with password "password123" (email provider). Flight dates are relative
-- to current_date so the matching pipeline always has upcoming work:
--   TO LAX  on current_date + 5: four riders with overlapping windows -> one group
--   FROM ONT on current_date + 6: two riders with overlapping windows  -> one group
--   TO LAX  on current_date + 9: one lone rider                        -> stays unmatched

with seed_users (id, email, full_name) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'superadmin@pickup.dev', 'Sam Superadmin'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'admin@pickup.dev',      'Alex Admin'),
    ('00000000-0000-4000-8000-000000000011'::uuid, 'ana@pickup.dev',        'Ana Alvarez'),
    ('00000000-0000-4000-8000-000000000012'::uuid, 'ben@pickup.dev',        'Ben Brooks'),
    ('00000000-0000-4000-8000-000000000013'::uuid, 'cara@pickup.dev',       'Cara Chen'),
    ('00000000-0000-4000-8000-000000000014'::uuid, 'dev@pickup.dev',        'Dev Desai'),
    ('00000000-0000-4000-8000-000000000015'::uuid, 'eli@pickup.dev',        'Eli Evans'),
    ('00000000-0000-4000-8000-000000000016'::uuid, 'fay@pickup.dev',        'Fay Fischer'),
    ('00000000-0000-4000-8000-000000000017'::uuid, 'gus@pickup.dev',        'Gus Garcia')
),
inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', full_name, 'school', 'Pomona'),
    now(), now(), '', '', '', ''
  from seed_users
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from inserted_users;

insert into public."Users" (user_id, email, firstname, lastname, school, phonenumber, role, admin_scope)
values
  ('00000000-0000-4000-8000-000000000001', 'superadmin@pickup.dev', 'Sam',  'Superadmin', 'Pomona', '9095550101', 'super_admin', null),
  ('00000000-0000-4000-8000-000000000002', 'admin@pickup.dev',      'Alex', 'Admin',      'Pomona', '9095550102', 'admin',       'Pomona'),
  ('00000000-0000-4000-8000-000000000011', 'ana@pickup.dev',        'Ana',  'Alvarez',    'Pomona', '9095550111', null,          null),
  ('00000000-0000-4000-8000-000000000012', 'ben@pickup.dev',        'Ben',  'Brooks',     'Pomona', '9095550112', null,          null),
  ('00000000-0000-4000-8000-000000000013', 'cara@pickup.dev',       'Cara', 'Chen',       'Pomona', '9095550113', null,          null),
  ('00000000-0000-4000-8000-000000000014', 'dev@pickup.dev',        'Dev',  'Desai',      'Pomona', '9095550114', null,          null),
  ('00000000-0000-4000-8000-000000000015', 'eli@pickup.dev',        'Eli',  'Evans',      'Pomona', '9095550115', null,          null),
  ('00000000-0000-4000-8000-000000000016', 'fay@pickup.dev',        'Fay',  'Fischer',    'Pomona', '9095550116', null,          null),
  ('00000000-0000-4000-8000-000000000017', 'gus@pickup.dev',        'Gus',  'Garcia',     'Pomona', '9095550117', null,          null);

insert into public."Flights" (
  user_id, airline_iata, flight_no, airport, terminal, to_airport, date,
  earliest_time, latest_time, bag_no, bag_no_large, bag_no_personal, matching_status
)
values
  ('00000000-0000-4000-8000-000000000011', 'AA', 1201, 'LAX', '4', true,  current_date + 5, '08:00', '10:00', 1, 0, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000012', 'UA',  455, 'LAX', '7', true,  current_date + 5, '08:30', '10:30', 1, 1, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000013', 'DL',  880, 'LAX', '3', true,  current_date + 5, '09:00', '11:00', 0, 1, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000014', 'AA', 1201, 'LAX', '4', true,  current_date + 5, '08:15', '09:45', 1, 0, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000015', 'WN', 2210, 'ONT', '2', false, current_date + 6, '14:00', '16:00', 1, 0, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000016', 'WN', 1934, 'ONT', '2', false, current_date + 6, '14:30', '16:30', 0, 1, 1, 'submitted'),
  ('00000000-0000-4000-8000-000000000017', 'AS',  301, 'LAX', '6', true,  current_date + 9, '06:00', '07:00', 1, 0, 1, 'submitted');
