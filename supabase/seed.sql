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

-- ---------------------------------------------------------------------------------------------
-- Demo data: a realistic term in progress, so every page has something to show.
--
--   * 36 more students across the five colleges (s01@pickup.dev .. s36@pickup.dev)
--   * Upcoming ride groups: subsidized LAX/ONT in both directions, a non-subsidized group and a
--     Connect group, committed through the real commit_matching_run RPC (vouchers get assigned)
--   * Past ride groups with feedback, a no-show report and cancellations (billable + waived)
--   * Unmatched riders on the "Find a group" board, flights waiting for the next run
--   * Algorithm run history, a scheduled run, admin change log entries, match requests
--
-- The original accounts and flights above stay pending, so `./start.sh ml` still has work to do.
-- ---------------------------------------------------------------------------------------------

-- One DO block: the seed runner sends the file as a single batch and checks every statement
-- before running any, so plain statements can't use the helper tables created here.
do $seed$
begin
  create schema demo;
  create table demo.students (n int primary key, id uuid, first text, last text, school text);
  insert into demo.students
  select
    n,
    ('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
    (array['Maya','Leo','Priya','Jonah','Sofia','Ethan','Amara','Noah','Chloe','Mateo','Hana','Owen',
           'Isla','Kai','Zoe','Ravi','Lucia','Theo','Nia','Felix','Aria','Diego','Mei','Sam',
           'Leila','Marcus','Ingrid','Tariq','Rosa','Jun','Ellie','Omar','Tessa','Hugo','Yara','Ben'])[n],
    (array['Patel','Nguyen','Okafor','Schmidt','Rossi','Kim','Haddad','Johnson','Lopez','Silva','Tanaka','Murphy',
           'Novak','Cohen','Mensah','Gupta','Fernandez','Walsh','Adeyemi','Larsen','Chowdhury','Ramos','Lin','Becker',
           'Aziz','Brown','Berg','Khan','Ortiz','Park','Davies','Farouk','Quinn','Moreau','Saleh','Hart'])[n],
    case when n % 9 = 0 then 'Scripps' when n % 11 = 0 then 'Claremont McKenna'
         when n % 13 = 0 then 'Pitzer' when n % 17 = 0 then 'Harvey Mudd' else 'Pomona' end
  from generate_series(1, 36) as n;

  with inserted_users as (
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    select
      '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
      's' || lpad(n::text, 2, '0') || '@pickup.dev',
      extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', first || ' ' || last, 'school', school),
      now() - interval '40 days', now(), '', '', '', ''
    from demo.students
    returning id, email
  )
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text,
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         'email', now(), now(), now()
  from inserted_users;

  insert into public."Users" (user_id, email, firstname, lastname, school, phonenumber, instagram, sms_opt_in, created_at)
  select id, 's' || lpad(n::text, 2, '0') || '@pickup.dev', first, last, school,
         '909555' || lpad((200 + n)::text, 4, '0'),
         case when n % 3 = 0 then lower(first) || '.' || lower(last) end,
         n % 2 = 0, now() - interval '40 days'
  from demo.students;

  -- Flight specs. kind: g:<group> = in a ride group, unmatched = on the board, submitted = next run
  create table demo.flights (
    n int, airline text, flight_no int, airport text, terminal text, to_airport boolean,
    day int, earliest time, latest time, bags int, large int, kind text, flight_id bigint
  );
  insert into demo.flights (n, airline, flight_no, airport, terminal, to_airport, day, earliest, latest, bags, large, kind) values
    -- Upcoming subsidized groups
    ( 1, 'AA', 2231, 'LAX', '4', true,   4, '06:00', '08:00', 1, 0, 'g:up-lax-to'),
    ( 2, 'UA', 1187, 'LAX', '7', true,   4, '06:30', '08:30', 1, 1, 'g:up-lax-to'),
    ( 3, 'DL',  455, 'LAX', '3', true,   4, '06:15', '07:45', 0, 1, 'g:up-lax-to'),
    ( 4, 'AS',  621, 'LAX', '6', true,   4, '06:45', '08:15', 1, 0, 'g:up-lax-to'),
    ( 5, 'WN', 1502, 'LAX', '1', false,  5, '15:00', '17:00', 1, 0, 'g:up-lax-from'),
    ( 6, 'B6', 1023, 'LAX', '5', false,  5, '15:30', '17:30', 1, 1, 'g:up-lax-from'),
    ( 7, 'AA',  118, 'LAX', '4', false,  5, '15:15', '16:45', 0, 1, 'g:up-lax-from'),
    ( 8, 'WN',  877, 'ONT', '2', true,   6, '10:00', '12:00', 1, 0, 'g:up-ont-to'),
    ( 9, 'WN', 2011, 'ONT', '2', true,   6, '10:30', '12:30', 1, 0, 'g:up-ont-to'),
    (10, 'AS', 1468, 'ONT', '2', false,  7, '19:00', '21:00', 1, 1, 'g:up-ont-from'),
    (11, 'DL', 1977, 'ONT', '4', false,  7, '19:15', '20:45', 0, 1, 'g:up-ont-from'),
    -- Upcoming non-subsidized (mixed colleges) and Connect groups
    (12, 'UA',  733, 'LAX', '7', true,   8, '13:00', '15:00', 1, 0, 'g:up-lax-mixed'),
    (18, 'AA', 2654, 'LAX', '4', true,   8, '13:30', '15:00', 1, 1, 'g:up-lax-mixed'),
    (27, 'DL', 1209, 'LAX', '3', true,   8, '13:15', '14:45', 0, 1, 'g:up-lax-mixed'),
    (13, 'WN', 3412, 'LAX', '1', false,  9, '21:00', '23:00', 1, 0, 'g:up-lax-connect'),
    (14, 'NK',  412, 'LAX', '1', false,  9, '21:15', '23:15', 1, 0, 'g:up-lax-connect'),
    -- Past groups (feedback, a no-show, cancellations)
    (15, 'AA', 1844, 'LAX', '4', true, -10, '07:00', '09:00', 1, 0, 'g:past-lax-to'),
    (16, 'UA', 2290, 'LAX', '7', true, -10, '07:15', '08:45', 1, 1, 'g:past-lax-to'),
    (17, 'DL',  902, 'LAX', '3', true, -10, '07:30', '09:30', 0, 1, 'g:past-lax-to'),
    (19, 'AS',  377, 'LAX', '6', true, -10, '07:00', '08:30', 1, 0, 'g:past-lax-to'),
    (20, 'WN', 1130, 'ONT', '2', false, -6, '16:00', '18:00', 1, 0, 'g:past-ont-from'),
    (21, 'WN', 1675, 'ONT', '2', false, -6, '16:30', '18:00', 1, 1, 'g:past-ont-from'),
    (22, 'AA', 2873, 'ONT', '4', false, -6, '16:15', '17:45', 0, 1, 'g:past-ont-from'),
    (23, 'UA',  561, 'LAX', '7', false, -3, '12:00', '14:00', 1, 0, 'g:past-lax-from'),
    (24, 'B6',  387, 'LAX', '5', false, -3, '12:30', '14:30', 1, 1, 'g:past-lax-from'),
    (25, 'DL', 2216, 'LAX', '3', false, -3, '12:15', '13:45', 0, 1, 'g:past-lax-from'),
    -- Unmatched riders, opted in to the "Find a group" board
    (26, 'AA',  761, 'LAX', '4', true,   3, '05:00', '06:00', 1, 0, 'unmatched'),
    (28, 'WN', 2299, 'ONT', '2', true,   5, '22:00', '23:00', 1, 0, 'unmatched'),
    (29, 'UA', 1912, 'LAX', '7', false,  6, '01:00', '02:30', 1, 1, 'unmatched'),
    (30, 'AS',  845, 'LAX', '6', false, 10, '09:00', '10:00', 0, 1, 'unmatched'),
    (31, 'F9', 1288, 'ONT', '4', false, 11, '23:00', '23:59', 1, 0, 'unmatched'),
    -- Submitted, waiting for the next matching run
    (32, 'AA',  433, 'LAX', '4', true,  12, '08:00', '10:00', 1, 0, 'submitted'),
    (33, 'DL', 1555, 'LAX', '3', true,  12, '08:30', '10:30', 1, 1, 'submitted'),
    (34, 'WN',  918, 'ONT', '2', false, 13, '14:00', '16:00', 0, 1, 'submitted'),
    (35, 'UA',  276, 'LAX', '7', false, 14, '18:00', '20:00', 1, 0, 'submitted'),
    (36, 'AS', 1733, 'LAX', '6', true,  14, '11:00', '13:00', 1, 0, 'submitted');

  with inserted as (
    insert into public."Flights" (
      user_id, airline_iata, flight_no, airport, terminal, to_airport, date, earliest_time, latest_time,
      bag_no, bag_no_large, bag_no_personal, opt_in, matching_status, has_us_phone, created_at
    )
    select s.id, f.airline, f.flight_no, f.airport, f.terminal, f.to_airport, current_date + f.day,
           f.earliest, f.latest, f.bags, f.large, 1, f.kind = 'unmatched' or f.n % 2 = 0,
           'submitted', true, now() - make_interval(days => greatest(20 - f.day, 1))
    from demo.flights f join demo.students s using (n)
    returning flight_id, user_id
  )
  update demo.flights f set flight_id = i.flight_id
  from inserted i join demo.students s on s.id = i.user_id
  where s.n = f.n;

  -- Vouchers: group vouchers per airport/direction, plus contingency vouchers for rides home
  insert into public."Vouchers" (date_start_label, date_end_label, start_date, end_date, contingency, voucher_link, to_airport, airport)
  select to_char(current_date - 30, 'Mon DD'), to_char(current_date + 30, 'Mon DD'),
         current_date - 30, current_date + 30, c.contingency,
         'https://r.uber.com/DEMO' || upper(a.airport) || case when a.to_airport then 'TO' else 'FROM' end
           || case when c.contingency then 'C' else 'G' end || i,
         a.to_airport, a.airport
  from (values ('LAX', true), ('LAX', false), ('ONT', true), ('ONT', false)) as a(airport, to_airport)
  cross join (values (false), (true)) as c(contingency)
  cross join generate_series(1, 6) as i
  where not (c.contingency and a.to_airport);

  -- Two matching runs (past and upcoming), committed through the real RPC.
  -- Each group rides at its latest member's earliest time (the start of the shared window).
  create function demo.commit_groups(p_run_id uuid, p_groups text[], p_subsidized text[], p_connect text[], p_unmatched text) returns void
  language plpgsql as $$
  declare
    v_payload jsonb;
  begin
    with members as (
      select substr(f.kind, 3) as label, f.airport, f.to_airport, current_date + f.day as ride_date,
             jsonb_build_object(
               'user_id', s.id, 'flight_id', f.flight_id, 'date', current_date + f.day,
               'time', max(f.earliest) over w,
               'earliest_time', f.earliest, 'latest_time', f.latest, 'source', 'ml', 'is_verified', true,
               'uber_type', case when count(*) over w > 3 or sum(f.large) over w > 2 then 'XL' else 'X' end
             ) as member
      from demo.flights f join demo.students s using (n)
      where substr(f.kind, 3) = any(p_groups)
      window w as (partition by f.kind)
    ),
    grouped as (
      select label, min(ride_date) as ride_date, min(airport) as airport, bool_and(to_airport) as to_airport,
             jsonb_agg(member) as members
      from members
      group by label
    )
    select jsonb_build_object(
      'run_id', p_run_id,
      'unmatched_flight_ids', coalesce((select jsonb_agg(flight_id) from demo.flights where kind = p_unmatched), '[]'::jsonb),
      'groups', jsonb_agg(jsonb_build_object(
        'ride_date', ride_date,
        'airport', airport,
        'to_airport', to_airport,
        'is_subsidized', label = any(p_subsidized),
        'ride_type', case when label = any(p_connect) then 'Connect' end,
        'members', members
      ))
    )
    into v_payload
    from grouped;

    perform public.commit_matching_run(p_run_id, v_payload);
  end;
  $$;

  perform demo.commit_groups(
    'aaaaaaaa-0000-4000-8000-000000000001',
    array['past-lax-to', 'past-ont-from', 'past-lax-from'],
    array['past-lax-to', 'past-ont-from', 'past-lax-from'],
    array[]::text[],
    null
  );
  perform demo.commit_groups(
    'aaaaaaaa-0000-4000-8000-000000000002',
    array['up-lax-to', 'up-lax-from', 'up-ont-to', 'up-ont-from', 'up-lax-mixed', 'up-lax-connect'],
    array['up-lax-to', 'up-lax-from', 'up-ont-to', 'up-ont-from'],
    array['up-lax-connect'],
    'unmatched'
  );

  update public."MatchingRuns" set started_at = now() - interval '12 days', committed_at = now() - interval '12 days',
    created_at = now() - interval '12 days'
  where run_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  update public."MatchingRuns" set started_at = now() - interval '1 day', committed_at = now() - interval '1 day',
    created_at = now() - interval '1 day'
  where run_id = 'aaaaaaaa-0000-4000-8000-000000000002';

  -- Match emails: past groups were emailed, upcoming ones wait for the admin to send them
  update public."Matches" m set email_sent = true
  from demo.flights f where f.flight_id = m.flight_id and f.day < 0;

  -- Past LAX group: everyone checked in through ASPC Ready, but one rider never showed up
  update public."Matches" m
  set ready_for_pickup_status = 'ready',
      ready_for_pickup_at = (m.date + m.time)::timestamp at time zone 'America/Los_Angeles' - interval '10 minutes',
      group_ready_at = (m.date + m.time)::timestamp at time zone 'America/Los_Angeles' - interval '5 minutes'
  from demo.flights f where f.flight_id = m.flight_id and f.kind = 'g:past-lax-to' and f.n <> 19;
  update public."Matches" m
  set ready_for_pickup_status = 'reporting_missing',
      reported_missing_user_ids = array[(select id from demo.students where n = 19)]
  from demo.flights f where f.flight_id = m.flight_id and f.kind = 'g:past-lax-to' and f.n = 15;

  -- Cancellations, recorded the way cancel_own_match does it: one billable (after the deadline,
  -- subsidized) and one waived (before the deadline)
  create table demo.cancellations (n int, after_deadline boolean, before_1hr boolean, reason text);
  insert into demo.cancellations values
    (25, true,  false, 'Flight got cancelled, rebooked for the next morning'),
    ( 7, false, false, 'Changed travel plans');
  insert into public.match_cancellations (
    ride_id, user_id, flight_id, cancelled_at, match_date, match_time, airport, to_airport,
    is_subsidized, cancelled_after_deadline, cancelled_before_1hr, reason, waived
  )
  select m.ride_id, m.user_id, m.flight_id,
         case when c.after_deadline then (m.date + m.time)::timestamp at time zone 'America/Los_Angeles' - interval '3 hours'
              else now() - interval '6 hours' end,
         m.date, m.time, f.airport, f.to_airport, m.is_subsidized, c.after_deadline, c.before_1hr, c.reason,
         not c.after_deadline
  from demo.cancellations c
  join demo.flights f using (n)
  join public."Matches" m on m.flight_id = f.flight_id;
  delete from public."Matches" m using demo.cancellations c join demo.flights f using (n) where m.flight_id = f.flight_id;
  update public."Flights" fl set matching_status = 'unmatched'
  from demo.cancellations c join demo.flights f using (n) where fl.flight_id = f.flight_id;

  -- Feedback on past rides
  insert into public."Feedback" (user_id, flight_id, overall, convenience, comments, created_at)
  select s.id, f.flight_id, v.overall, v.convenience, v.comments, now() - make_interval(days => -f.day - 1)
  from (values
    (15, 5, 5, 'Super smooth, the group was ready on time and the XL fit all our bags.'),
    (16, 4, 5, 'Great! Took a bit to find each other at terminal 7.'),
    (17, 5, 4, null),
    (20, 4, 4, 'Easy pickup at ONT. Would use again.'),
    (21, 3, 3, 'Driver was 15 min late, but the group was nice.'),
    (24, 5, 5, 'Saved me so much money, thank you ASPC!')
  ) as v(n, overall, convenience, comments)
  join demo.flights f using (n) join demo.students s using (n);

  -- Algorithm run history and the next scheduled run (admin dashboard)
  insert into public."AlgorithmStatus" (algorithm_name, scheduled_for, started_at, finished_at, status, run_id, target, error_message)
  values
    ('matching', now() - interval '12 days', now() - interval '12 days', now() - interval '12 days' + interval '41 seconds',
     'success', 'aaaaaaaa-0000-4000-8000-000000000001', 'ASPC', null),
    ('matching', now() - interval '5 days', now() - interval '5 days', now() - interval '5 days' + interval '9 seconds',
     'failed', null, 'All', 'No available group voucher for airport ONT, direction to_airport'),
    ('matching', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day' + interval '37 seconds',
     'success', 'aaaaaaaa-0000-4000-8000-000000000002', 'ASPC', null),
    ('matching', date_trunc('day', now()) + interval '2 days 9 hours', null, null, 'scheduled', null, 'All', null);

  -- Admin change log
  insert into public."ChangeLog" (actor_user_id, actor_role, action, algorithm_run_id, target_user_id, target_group_id, metadata, created_at, confirmed)
  select a.actor, a.role, a.action, a.run_id, a.target, a.ride, a.metadata, a.at, true
  from (values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'super_admin', 'RUN_ALGORITHM', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
     null::uuid, null::bigint, '{"target": "ASPC"}'::jsonb, now() - interval '12 days'),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'super_admin', 'RUN_ALGORITHM', 'aaaaaaaa-0000-4000-8000-000000000002'::uuid,
     null, null, '{"target": "ASPC"}'::jsonb, now() - interval '1 day'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'admin', 'UPDATE_GROUP_TIME', null,
     null, (select ride_id from public."Matches" m join demo.flights f using (flight_id) where f.n = 5),
     '{"old_time": "15:30", "new_time": "15:45"}'::jsonb, now() - interval '20 hours'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'admin', 'UPDATE_RIDER_DETAILS', null,
     (select id from demo.students where n = 2), null, '{"field": "bag_no_large", "old": 0, "new": 1}'::jsonb, now() - interval '18 hours')
  ) as a(actor, role, action, run_id, target, ride, metadata, at);

  -- Match requests between unmatched riders (shown when NEXT_PUBLIC_ENABLE_MATCH_REQUESTS=true)
  insert into public."MatchRequests" (sender_id, receiver_id, status, sender_flight_id, receiver_flight_id, created_at)
  select s1.id, s2.id, r.status, f1.flight_id, f2.flight_id, now() - r.age
  from (values (29, 26, 'pending', interval '3 hours'), (31, 30, 'rejected', interval '2 days')) as r(from_n, to_n, status, age)
  join demo.students s1 on s1.n = r.from_n join demo.flights f1 on f1.n = r.from_n
  join demo.students s2 on s2.n = r.to_n join demo.flights f2 on f2.n = r.to_n;

  drop schema demo cascade;
end
$seed$;
