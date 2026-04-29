-- Transactional ASPC delay write commands.
-- Keeps the delay flow's multi-table mutations and audit logging atomic.

begin;

create or replace function public.insert_aspc_delay_change_log(
  p_user_id uuid,
  p_ride_id bigint,
  p_flight_id bigint,
  p_reason_for_delay text,
  p_old_flight_date date,
  p_old_match_date date,
  p_old_match_time time without time zone,
  p_new_eta_date date,
  p_new_eta_time time without time zone,
  p_outcome text,
  p_new_eta_time_earliest time without time zone default null,
  p_new_eta_time_latest time without time zone default null,
  p_new_flight jsonb default null,
  p_new_ride_id bigint default null,
  p_contingency_voucher_assigned boolean default null,
  p_assigned_contingency_voucher text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_firstname text;
  v_lastname text;
  v_rider_name text;
  v_metadata jsonb;
begin
  select u.firstname, u.lastname
  into v_firstname, v_lastname
  from public."Users" u
  where u.user_id = p_user_id;

  v_rider_name := trim(concat(coalesce(v_firstname, ''), ' ', coalesce(v_lastname, '')));

  v_metadata := jsonb_build_object(
    'source', 'aspc_delay',
    'reason_for_delay', p_reason_for_delay,
    'old_flight_date', p_old_flight_date,
    'old_match_date', p_old_match_date,
    'old_match_time', case when p_old_match_time is null then null else to_char(p_old_match_time, 'HH24:MI:SS') end,
    'new_eta_date', p_new_eta_date,
    'new_eta_time', to_char(p_new_eta_time, 'HH24:MI:SS'),
    'outcome', p_outcome,
    'rider_flight_id', p_flight_id
  )
  || case
    when p_new_eta_time_earliest is not null and p_new_eta_time_latest is not null
      then jsonb_build_object(
        'new_eta_time_earliest', to_char(p_new_eta_time_earliest, 'HH24:MI:SS'),
        'new_eta_time_latest', to_char(p_new_eta_time_latest, 'HH24:MI:SS')
      )
      else '{}'::jsonb
  end
  || case
    when p_new_flight is not null
      then jsonb_build_object(
        'new_flight_airport', p_new_flight ->> 'airport',
        'new_flight_no', p_new_flight ->> 'flight_no',
        'new_flight_date', p_new_flight ->> 'date',
        'new_flight_time', p_new_flight ->> 'time'
      )
      else '{}'::jsonb
  end
  || case
    when p_new_ride_id is not null
      then jsonb_build_object('new_ride_id', p_new_ride_id)
      else '{}'::jsonb
  end
  || case
    when p_outcome = 'solo_ride_created'
      then jsonb_build_object(
        'contingency_voucher_assigned', coalesce(p_contingency_voucher_assigned, false)
      )
      else '{}'::jsonb
  end
  || case
    when p_outcome = 'solo_ride_created'
      and coalesce(p_contingency_voucher_assigned, false)
      and nullif(coalesce(p_assigned_contingency_voucher, ''), '') is not null
      then jsonb_build_object(
        'assigned_contingency_voucher', p_assigned_contingency_voucher
      )
      else '{}'::jsonb
  end
  || case
    when nullif(v_rider_name, '') is not null
      then jsonb_build_object('rider_name', v_rider_name)
      else '{}'::jsonb
  end;

  insert into public."ChangeLog" (
    actor_user_id,
    actor_role,
    action,
    target_group_id,
    target_user_id,
    metadata,
    ignored_error,
    confirmed
  )
  values (
    p_user_id,
    'Rider',
    'ASPC_DELAY',
    p_ride_id,
    p_user_id,
    v_metadata,
    false,
    true
  );
end;
$function$;

create or replace function public.aspc_delay_keep_original_group(
  p_ride_id bigint,
  p_user_id uuid,
  p_flight_id bigint,
  p_reason_for_delay text,
  p_old_flight_date date,
  p_old_match_date date,
  p_old_match_time time without time zone,
  p_new_eta_date date,
  p_new_eta_time time without time zone,
  p_new_eta_time_earliest time without time zone default null,
  p_new_eta_time_latest time without time zone default null,
  p_new_flight jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform 1
  from public."Matches"
  where ride_id = p_ride_id
    and user_id = p_user_id
    and flight_id = p_flight_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  update public."Matches"
  set reason_for_delay = null
  where ride_id = p_ride_id
    and user_id = p_user_id
    and flight_id = p_flight_id;

  perform public.insert_aspc_delay_change_log(
    p_user_id,
    p_ride_id,
    p_flight_id,
    p_reason_for_delay,
    p_old_flight_date,
    p_old_match_date,
    p_old_match_time,
    p_new_eta_date,
    p_new_eta_time,
    'kept_original_group_eta_earlier',
    p_new_eta_time_earliest,
    p_new_eta_time_latest,
    p_new_flight,
    null,
    null,
    null
  );

  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.aspc_delay_move_to_unmatched(
  p_ride_id bigint,
  p_user_id uuid,
  p_flight_id bigint,
  p_reason_for_delay text,
  p_old_flight_date date,
  p_old_match_date date,
  p_old_match_time time without time zone,
  p_new_eta_date date,
  p_new_eta_time time without time zone,
  p_new_eta_time_earliest time without time zone default null,
  p_new_eta_time_latest time without time zone default null,
  p_new_flight jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deleted_flight_id bigint;
begin
  perform 1
  from public."Matches"
  where ride_id = p_ride_id
    and user_id = p_user_id
    and flight_id = p_flight_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  perform 1
  from public."Flights"
  where flight_id = p_flight_id
  for update;

  with deleted as (
    delete from public."Matches"
    where ride_id = p_ride_id
      and user_id = p_user_id
      and flight_id = p_flight_id
    returning flight_id
  )
  select flight_id
  into v_deleted_flight_id
  from deleted
  limit 1;

  if v_deleted_flight_id is null then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'This delay request is stale because the rider is no longer in that group.'
    );
  end if;

  update public."Flights"
  set matched = false
  where flight_id = v_deleted_flight_id;

  perform public.insert_aspc_delay_change_log(
    p_user_id,
    p_ride_id,
    p_flight_id,
    p_reason_for_delay,
    p_old_flight_date,
    p_old_match_date,
    p_old_match_time,
    p_new_eta_date,
    p_new_eta_time,
    'delay_no_group_unmatched',
    p_new_eta_time_earliest,
    p_new_eta_time_latest,
    p_new_flight,
    null,
    null,
    null
  );

  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.aspc_delay_create_solo_ride(
  p_ride_id bigint,
  p_user_id uuid,
  p_flight_id bigint,
  p_reason_for_delay text,
  p_old_flight_date date,
  p_old_match_date date,
  p_old_match_time time without time zone,
  p_new_eta_date date,
  p_new_eta_time time without time zone,
  p_new_eta_time_earliest time without time zone default null,
  p_new_eta_time_latest time without time zone default null,
  p_new_flight jsonb default null,
  p_contingency_voucher text default null,
  p_is_subsidized boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_new_ride_id bigint;
begin
  perform 1
  from public."Matches"
  where ride_id = p_ride_id
    and user_id = p_user_id
    and flight_id = p_flight_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  insert into public."Rides" (ride_date)
  values (p_new_eta_date)
  returning ride_id into v_new_ride_id;

  update public."Matches"
  set
    ride_id = v_new_ride_id,
    date = p_new_eta_date,
    time = p_new_eta_time,
    uber_type = 'X',
    voucher = null,
    is_subsidized = p_is_subsidized,
    contingency_voucher = p_contingency_voucher
  where ride_id = p_ride_id
    and user_id = p_user_id
    and flight_id = p_flight_id;

  perform public.insert_aspc_delay_change_log(
    p_user_id,
    p_ride_id,
    p_flight_id,
    p_reason_for_delay,
    p_old_flight_date,
    p_old_match_date,
    p_old_match_time,
    p_new_eta_date,
    p_new_eta_time,
    'solo_ride_created',
    p_new_eta_time_earliest,
    p_new_eta_time_latest,
    p_new_flight,
    v_new_ride_id,
    true,
    p_contingency_voucher
  );

  return jsonb_build_object(
    'success', true,
    'rideId', v_new_ride_id
  );
end;
$function$;

create or replace function public.aspc_delay_join_group(
  p_current_ride_id bigint,
  p_user_id uuid,
  p_selected_ride_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_selected_date date;
  v_selected_time time without time zone;
  v_selected_uber_type text;
  v_selected_voucher text;
  v_group_subsidized boolean;
  v_group_rider_count integer;
  v_user_school text;
begin
  perform 1
  from public."Matches"
  where ride_id = p_current_ride_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  perform 1
  from public."Matches"
  where ride_id = p_selected_ride_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'No match found for that ride.'
    );
  end if;

  select date, time, uber_type, voucher
  into v_selected_date, v_selected_time, v_selected_uber_type, v_selected_voucher
  from public."Matches"
  where ride_id = p_selected_ride_id
  order by id
  limit 1;

  select count(*)
  into v_group_rider_count
  from public."Matches"
  where ride_id = p_selected_ride_id;

  if coalesce(v_group_rider_count, 0) >= 6 then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'That delay group is already full.'
    );
  end if;

  v_group_subsidized :=
    coalesce(nullif(trim(coalesce(v_selected_voucher, '')), ''), '') <> ''
    or lower(coalesce(v_selected_uber_type, '')) = 'connect';

  select school
  into v_user_school
  from public."Users"
  where user_id = p_user_id;

  if v_group_subsidized and coalesce(v_user_school, '') <> 'Pomona' then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Only Pomona College students can join ASPC-subsidized groups.'
    );
  end if;

  update public."Matches"
  set
    ride_id = p_selected_ride_id,
    date = v_selected_date,
    time = v_selected_time,
    uber_type = coalesce(v_selected_uber_type, 'X'),
    voucher = nullif(v_selected_voucher, 'NA'),
    is_subsidized = v_group_subsidized
  where ride_id = p_current_ride_id
    and user_id = p_user_id;

  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.aspc_delay_decline_groups(
  p_current_ride_id bigint,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_flight_id bigint;
begin
  select flight_id
  into v_flight_id
  from public."Matches"
  where ride_id = p_current_ride_id
    and user_id = p_user_id
  for update;

  if v_flight_id is null then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  perform 1
  from public."Flights"
  where flight_id = v_flight_id
  for update;

  delete from public."Matches"
  where ride_id = p_current_ride_id
    and user_id = p_user_id;

  update public."Flights"
  set matched = false
  where flight_id = v_flight_id;

  return jsonb_build_object('success', true);
end;
$function$;

revoke execute on function public.insert_aspc_delay_change_log(uuid, bigint, bigint, text, date, date, time without time zone, date, time without time zone, text, time without time zone, time without time zone, jsonb, bigint, boolean, text) from public, anon, authenticated;
revoke execute on function public.aspc_delay_keep_original_group(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb) from public, anon, authenticated;
revoke execute on function public.aspc_delay_move_to_unmatched(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb) from public, anon, authenticated;
revoke execute on function public.aspc_delay_create_solo_ride(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.aspc_delay_join_group(bigint, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.aspc_delay_decline_groups(bigint, uuid) from public, anon, authenticated;

grant execute on function public.aspc_delay_keep_original_group(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb) to service_role;
grant execute on function public.aspc_delay_move_to_unmatched(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb) to service_role;
grant execute on function public.aspc_delay_create_solo_ride(bigint, uuid, bigint, text, date, date, time without time zone, date, time without time zone, time without time zone, time without time zone, jsonb, text, boolean) to service_role;
grant execute on function public.aspc_delay_join_group(bigint, uuid, bigint) to service_role;
grant execute on function public.aspc_delay_decline_groups(bigint, uuid) to service_role;

commit;
