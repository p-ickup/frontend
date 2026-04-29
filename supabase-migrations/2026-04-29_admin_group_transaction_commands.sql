-- Transactional admin group commands for the highest-risk multi-table writes.

begin;

create or replace function public.create_group_records(
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
  set matched = true
  where flight_id = any(v_flight_ids);

  return jsonb_build_object(
    'success', true,
    'rideId', v_ride_id,
    'normalizedVoucher', p_normalized_voucher
  );
end;
$function$;

create or replace function public.delete_group_records(
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
      set matched = false
      where flight_id = any(v_all_flight_ids);
    end if;
  end if;

  return jsonb_build_object('success', true);
end;
$function$;

revoke execute on function public.create_group_records(date, jsonb, time without time zone, text, text, boolean, text, boolean) from public, anon, authenticated;
revoke execute on function public.delete_group_records(bigint, bigint[], boolean) from public, anon, authenticated;

grant execute on function public.create_group_records(date, jsonb, time without time zone, text, text, boolean, text, boolean) to service_role;
grant execute on function public.delete_group_records(bigint, bigint[], boolean) to service_role;

commit;
