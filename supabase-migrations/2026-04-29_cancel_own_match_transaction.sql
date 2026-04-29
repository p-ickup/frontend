-- Transactional match cancellation.
-- Replaces the stub RPC so ride cancellation audit, match deletion, and
-- flight unmatched updates succeed or roll back together.

begin;

create or replace function public.cancel_own_match(p_ride_id bigint)
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
  -- FOR UPDATE cannot target the nullable side (Flights) of a LEFT JOIN; lock Matches only.
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

  if v_match_count <= 2 then
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
    set matched = false
    where flight_id = any(v_deleted_flight_ids);
  end if;

  return jsonb_build_object(
    'success', true
  );
end;
$function$;

revoke execute on function public.cancel_own_match(bigint) from public, anon;
grant execute on function public.cancel_own_match(bigint) to authenticated, service_role;

commit;
