-- Transactional match-request acceptance.
-- Replaces the stub RPC with a real command so request acceptance either
-- completes as a unit or rolls back cleanly.

begin;

create or replace function public.accept_match_request(p_request_id uuid)
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
    matched
  into v_sender_flight
  from public."Flights"
  where flight_id = v_request.sender_flight_id
  for update;

  select
    flight_id,
    user_id,
    date,
    earliest_time,
    matched
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

  if coalesce(v_sender_flight.matched, false) or coalesce(v_receiver_flight.matched, false) then
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
  set matched = true
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

revoke execute on function public.accept_match_request(uuid) from public, anon;
grant execute on function public.accept_match_request(uuid) to authenticated, service_role;

commit;
