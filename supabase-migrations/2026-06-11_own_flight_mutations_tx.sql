-- Transactional student flight update/delete.
-- Blocks edits/deletes when matched; cleans up pending MatchRequests atomically.

begin;

create or replace function public.delete_own_flight_tx(p_flight_id bigint)
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
    matched
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

  if v_flight.matched = true
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

create or replace function public.update_own_flight_tx(
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
    matched
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

  if v_flight.matched = true
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

commit;
