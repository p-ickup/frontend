-- Item 5 migration 2: RPC cutover Flights.matched -> matching_status
-- Apply in Supabase SQL editor BEFORE deploying frontend.
-- commit_matching_run already writes matching_status; omitted.

-- accept_match_request
CREATE OR REPLACE function public.accept_match_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_request public."MatchRequests"%rowtype;
  v_sender_flight record;
  v_receiver_flight record;
  v_sender_match_id smallint;
  v_receiver_match_id smallint;
  v_ride_id bigint;
  v_match_date date;
  v_match_time time;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Authentication required.'
    );
  end if;

  select *
  into v_request
  from public."MatchRequests"
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match request not found.'
    );
  end if;

  if v_request.receiver_id is distinct from auth.uid() then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'You are not allowed to accept this request.'
    );
  end if;

  if coalesce(v_request.status, 'pending') <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'This match request is no longer pending.'
    );
  end if;

  if v_request.sender_id is null
     or v_request.receiver_id is null
     or v_request.sender_flight_id is null
     or v_request.receiver_flight_id is null then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'This match request is missing required flight details.'
    );
  end if;

  select
    flight_id,
    user_id,
    date,
    earliest_time,
    matching_status
  into v_sender_flight
  from public."Flights"
  where flight_id = v_request.sender_flight_id
  for update;

  select
    flight_id,
    user_id,
    date,
    earliest_time,
    matching_status
  into v_receiver_flight
  from public."Flights"
  where flight_id = v_request.receiver_flight_id
  for update;

  if v_sender_flight.flight_id is null or v_receiver_flight.flight_id is null then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'One of the request flights could not be found.'
    );
  end if;

  if v_sender_flight.user_id is distinct from v_request.sender_id
     or v_receiver_flight.user_id is distinct from v_request.receiver_id then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'The request no longer matches the selected flights.'
    );
  end if;

  if v_sender_flight.matching_status = 'matched' or v_receiver_flight.matching_status = 'matched' then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'One of these flights is already matched. Please refresh and try again.'
    );
  end if;

  select id
  into v_sender_match_id
  from public."Matches"
  where flight_id = v_request.sender_flight_id
  limit 1
  for update;

  select id
  into v_receiver_match_id
  from public."Matches"
  where flight_id = v_request.receiver_flight_id
  limit 1
  for update;

  if v_sender_match_id is not null or v_receiver_match_id is not null then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'This request is stale because one of the flights has already been grouped.'
    );
  end if;

  v_match_date := coalesce(v_sender_flight.date, v_receiver_flight.date);
  v_match_time := coalesce(v_sender_flight.earliest_time, v_receiver_flight.earliest_time);

  if v_match_date is null then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Unable to determine a ride date for this request.'
    );
  end if;

  insert into public."Rides" (ride_date)
  values (v_match_date)
  returning ride_id into v_ride_id;

  insert into public."Matches" (
    ride_id,
    user_id,
    flight_id,
    date,
    time,
    source,
    is_verified,
    voucher,
    is_subsidized,
    contingency_voucher,
    uber_type
  )
  values
    (
      v_ride_id,
      v_request.sender_id,
      v_request.sender_flight_id,
      v_match_date,
      v_match_time,
      'manual',
      false,
      null,
      null,
      null,
      null
    ),
    (
      v_ride_id,
      v_request.receiver_id,
      v_request.receiver_flight_id,
      v_match_date,
      v_match_time,
      'manual',
      false,
      null,
      null,
      null,
      null
    );

  update public."Flights"
  set matching_status = 'matched'
  where flight_id in (v_request.sender_flight_id, v_request.receiver_flight_id);

  update public."MatchRequests"
  set status = 'accepted'
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'rideId', v_ride_id
  );
end;
$function$;

-- cancel_own_match
CREATE OR REPLACE function public.cancel_own_match(p_ride_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_match record;
  v_match_count integer;
  v_all_ride_flight_ids bigint[];
  v_deleted_flight_ids bigint[];
  v_match_date date;
  v_match_time time without time zone;
  v_airport text;
  v_to_airport boolean;
  v_cancelled_before_1hr boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Authentication required.'
    );
  end if;

  select
    m.ride_id,
    m.user_id,
    m.flight_id,
    m.date as match_date,
    m.time as match_time,
    m.is_subsidized,
    f.airport,
    f.to_airport,
    f.date as flight_date,
    f.earliest_time as flight_time
  into v_user_match
  from public."Matches" m
  left join public."Flights" f
    on f.flight_id = m.flight_id
  where m.ride_id = p_ride_id
    and m.user_id = auth.uid()
  for update of m;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Match not found.'
    );
  end if;

  v_match_date := coalesce(v_user_match.match_date, v_user_match.flight_date);
  if v_match_date is null then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Unable to determine the match date for this cancellation.'
    );
  end if;

  v_match_time := coalesce(v_user_match.match_time, v_user_match.flight_time, time '12:00:00');
  v_airport := coalesce(v_user_match.airport, 'LAX');
  v_to_airport := coalesce(v_user_match.to_airport, true);

  perform 1
  from public."Matches"
  where ride_id = p_ride_id
  for update;

  select
    count(*),
    array_agg(flight_id order by flight_id) filter (where flight_id is not null)
  into v_match_count, v_all_ride_flight_ids
  from public."Matches"
  where ride_id = p_ride_id;

  if coalesce(v_match_count, 0) = 0 then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'This ride no longer has active matches.'
    );
  end if;

  if coalesce(array_length(v_all_ride_flight_ids, 1), 0) > 0 then
    perform 1
    from public."Flights"
    where flight_id = any(v_all_ride_flight_ids)
    for update;
  end if;

  v_cancelled_before_1hr :=
    now() <= ((v_match_date::timestamp + v_match_time) - interval '1 hour');

  insert into public.match_cancellations (
    ride_id,
    user_id,
    flight_id,
    match_date,
    match_time,
    airport,
    to_airport,
    is_subsidized,
    cancelled_after_deadline,
    cancelled_before_1hr,
    cancellation_type
  )
  values (
    p_ride_id::integer,
    auth.uid(),
    v_user_match.flight_id::integer,
    v_match_date,
    v_match_time,
    v_airport,
    v_to_airport,
    v_user_match.is_subsidized,
    true,
    v_cancelled_before_1hr,
    'student_initiated'
  );

  if v_match_count <= 1 then
    delete from public."Matches"
    where ride_id = p_ride_id;

    v_deleted_flight_ids := coalesce(v_all_ride_flight_ids, array[]::bigint[]);
  else
    delete from public."Matches"
    where ride_id = p_ride_id
      and user_id = auth.uid();

    v_deleted_flight_ids := array[v_user_match.flight_id];
  end if;

  if coalesce(array_length(v_deleted_flight_ids, 1), 0) > 0 then
    update public."Flights"
    set matching_status = 'unmatched'
    where flight_id = any(v_deleted_flight_ids);
  end if;

  return jsonb_build_object(
    'success', true
  );
end;
$function$;

-- create_group_records
CREATE OR REPLACE function public.create_group_records(
  p_ride_date date,
  p_riders jsonb,
  p_formatted_time time without time zone,
  p_normalized_voucher text,
  p_contingency_voucher text,
  p_assign_voucher boolean,
  p_uber_type text,
  p_is_subsidized boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ride_id bigint;
  v_flight_ids bigint[];
  v_rider_count integer;
  v_contingency_vouchers text[];
begin
  if jsonb_typeof(p_riders) <> 'array' or jsonb_array_length(p_riders) = 0 then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'At least one rider is required to create a group.'
    );
  end if;

  select
    array_agg((elem ->> 'flight_id')::bigint order by ordinality),
    count(*)
  into v_flight_ids, v_rider_count
  from jsonb_array_elements(p_riders) with ordinality as riders(elem, ordinality);

  v_contingency_vouchers :=
    case
      when nullif(trim(coalesce(p_contingency_voucher, '')), '') is null
        then array[]::text[]
      else regexp_split_to_array(p_contingency_voucher, '\s*,\s*')
    end;

  if coalesce(array_length(v_flight_ids, 1), 0) <> v_rider_count then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Each rider must include a valid flight_id.'
    );
  end if;

  insert into public."Rides" (ride_date)
  values (p_ride_date)
  returning ride_id into v_ride_id;

  with rider_rows as (
    select
      (elem ->> 'user_id')::uuid as user_id,
      (elem ->> 'flight_id')::bigint as flight_id,
      ordinality::integer as rider_index
    from jsonb_array_elements(p_riders) with ordinality as riders(elem, ordinality)
  )
  insert into public."Matches" (
    ride_id,
    user_id,
    flight_id,
    date,
    time,
    source,
    voucher,
    contingency_voucher,
    is_verified,
    is_subsidized,
    uber_type
  )
  select
    v_ride_id,
    rider_rows.user_id,
    rider_rows.flight_id,
    p_ride_date,
    p_formatted_time,
    'manual',
    case when p_assign_voucher then coalesce(p_normalized_voucher, '') else '' end,
    coalesce(v_contingency_vouchers[rider_rows.rider_index], null),
    false,
    p_is_subsidized,
    p_uber_type
  from rider_rows;

  update public."Flights"
  set matching_status = 'matched'
  where flight_id = any(v_flight_ids);

  return jsonb_build_object(
    'success', true,
    'rideId', v_ride_id,
    'normalizedVoucher', p_normalized_voucher
  );
end;
$function$;

-- delete_group_records
CREATE OR REPLACE function public.delete_group_records(
  p_group_id bigint,
  p_flight_ids bigint[] default null,
  p_mark_flights_unmatched boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deleted_flight_ids bigint[];
  v_all_flight_ids bigint[];
begin
  with deleted_matches as (
    delete from public."Matches"
    where ride_id = p_group_id
    returning flight_id
  )
  select coalesce(array_agg(flight_id), array[]::bigint[])
  into v_deleted_flight_ids
  from deleted_matches;

  delete from public."Rides"
  where ride_id = p_group_id;

  if p_mark_flights_unmatched then
    select coalesce(array_agg(distinct flight_id), array[]::bigint[])
    into v_all_flight_ids
    from (
      select unnest(coalesce(v_deleted_flight_ids, array[]::bigint[])) as flight_id
      union
      select unnest(coalesce(p_flight_ids, array[]::bigint[])) as flight_id
    ) flight_ids;

    if coalesce(array_length(v_all_flight_ids, 1), 0) > 0 then
      update public."Flights"
      set matching_status = 'unmatched'
      where flight_id = any(v_all_flight_ids);
    end if;
  end if;

  return jsonb_build_object('success', true);
end;
$function$;

-- aspc_delay_move_to_unmatched
CREATE OR REPLACE function public.aspc_delay_move_to_unmatched(
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
  set matching_status = 'unmatched'
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

-- aspc_delay_decline_groups
CREATE OR REPLACE function public.aspc_delay_decline_groups(
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
  set matching_status = 'unmatched'
  where flight_id = v_flight_id;

  return jsonb_build_object('success', true);
end;
$function$;

-- delete_own_flight_tx
CREATE OR REPLACE function public.delete_own_flight_tx(p_flight_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_flight record;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Authentication required.'
    );
  end if;

  select
    flight_id,
    user_id,
    matching_status
  into v_flight
  from public."Flights"
  where flight_id = p_flight_id
  for update;

  if not found or v_flight.user_id is distinct from auth.uid() then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Flight not found.'
    );
  end if;

  if v_flight.matching_status = 'matched'
     or exists (
       select 1
       from public."Matches" m
       where m.flight_id = p_flight_id
     ) then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'This flight is part of a match. Cancel your match from the Results page before deleting.'
    );
  end if;

  delete from public."MatchRequests"
  where status = 'pending'
    and (
      sender_flight_id = p_flight_id
      or receiver_flight_id = p_flight_id
    );

  delete from public."Flights"
  where flight_id = p_flight_id;

  return jsonb_build_object(
    'success', true
  );
end;
$function$;

-- update_own_flight_tx
CREATE OR REPLACE function public.update_own_flight_tx(
  p_flight_id bigint,
  p_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_flight record;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Authentication required.'
    );
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Flight fields must be an object.'
    );
  end if;

  select
    flight_id,
    user_id,
    matching_status
  into v_flight
  from public."Flights"
  where flight_id = p_flight_id
  for update;

  if not found or v_flight.user_id is distinct from auth.uid() then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Flight not found.'
    );
  end if;

  if v_flight.matching_status = 'matched'
     or exists (
       select 1
       from public."Matches" m
       where m.flight_id = p_flight_id
     ) then
    return jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'This flight is part of a match. Cancel your match from the Results page before deleting.'
    );
  end if;

  update public."Flights"
  set
    to_airport = case
      when p_fields ? 'to_airport' then (p_fields->>'to_airport')::boolean
      else to_airport
    end,
    airport = case
      when p_fields ? 'airport' then p_fields->>'airport'
      else airport
    end,
    flight_no = case
      when p_fields ? 'flight_no' then (p_fields->>'flight_no')::integer
      else flight_no
    end,
    airline_iata = case
      when p_fields ? 'airline_iata' then p_fields->>'airline_iata'
      else airline_iata
    end,
    date = case
      when p_fields ? 'date' then (p_fields->>'date')::date
      else date
    end,
    bag_no_personal = case
      when p_fields ? 'bag_no_personal' then (p_fields->>'bag_no_personal')::integer
      else bag_no_personal
    end,
    bag_no = case
      when p_fields ? 'bag_no' then (p_fields->>'bag_no')::integer
      else bag_no
    end,
    bag_no_large = case
      when p_fields ? 'bag_no_large' then (p_fields->>'bag_no_large')::integer
      else bag_no_large
    end,
    earliest_time = case
      when p_fields ? 'earliest_time' then (p_fields->>'earliest_time')::time without time zone
      else earliest_time
    end,
    latest_time = case
      when p_fields ? 'latest_time' then (p_fields->>'latest_time')::time without time zone
      else latest_time
    end,
    opt_in = case
      when p_fields ? 'opt_in' then (p_fields->>'opt_in')::boolean
      else opt_in
    end,
    terminal = case
      when p_fields ? 'terminal' then p_fields->>'terminal'
      else terminal
    end
  where flight_id = p_flight_id;

  delete from public."MatchRequests"
  where status = 'pending'
    and (
      sender_flight_id = p_flight_id
      or receiver_flight_id = p_flight_id
    );

  return jsonb_build_object(
    'success', true
  );
end;
$function$;
