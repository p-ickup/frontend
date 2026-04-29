-- Transactional ASPC ready-status submission.
-- Replaces the stub RPC so the caller status update and any ride-wide
-- group_ready_at stamp happen atomically.

begin;

create or replace function public.report_ready_status(
  p_ride_id bigint,
  p_status text,
  p_missing_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ride_user_ids uuid[];
  v_valid_missing_ids uuid[];
  v_accounted_for_ids uuid[];
  v_now_ready boolean;
  v_normalized_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Authentication required.'
    );
  end if;

  v_normalized_status := case
    when coalesce(lower(trim(p_status)), '') = 'ready' then 'ready'
    else 'reporting_missing'
  end;

  perform 1
  from public."Matches"
  where ride_id = p_ride_id
  for update;

  select array_agg(user_id order by user_id)
  into v_ride_user_ids
  from public."Matches"
  where ride_id = p_ride_id;

  if coalesce(array_length(v_ride_user_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Ride not found.'
    );
  end if;

  if not (auth.uid() = any(v_ride_user_ids)) then
    return jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'You are not a member of this ride.'
    );
  end if;

  if v_normalized_status = 'ready' then
    v_valid_missing_ids := array[]::uuid[];
  else
    select coalesce(array_agg(distinct missing_id), array[]::uuid[])
    into v_valid_missing_ids
    from unnest(coalesce(p_missing_user_ids, array[]::uuid[])) as missing_id
    where missing_id <> auth.uid()
      and missing_id = any(v_ride_user_ids);
  end if;

  update public."Matches"
  set
    ready_for_pickup_at = now(),
    ready_for_pickup_status = v_normalized_status,
    reported_missing_user_ids = v_valid_missing_ids
  where ride_id = p_ride_id
    and user_id = auth.uid();

  select coalesce(array_agg(distinct accounted.user_id), array[]::uuid[])
  into v_accounted_for_ids
  from (
    select m.user_id
    from public."Matches" m
    where m.ride_id = p_ride_id
      and m.ready_for_pickup_at is not null
    union
    select unnest(coalesce(m.reported_missing_user_ids, array[]::uuid[]))
    from public."Matches" m
    where m.ride_id = p_ride_id
  ) accounted;

  select
    count(*) > 0
    and bool_and(m.user_id = any(v_accounted_for_ids))
  into v_now_ready
  from public."Matches" m
  where m.ride_id = p_ride_id;

  if coalesce(v_now_ready, false) then
    update public."Matches"
    set group_ready_at = now()
    where ride_id = p_ride_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'nowReady', coalesce(v_now_ready, false)
  );
end;
$function$;

revoke execute on function public.report_ready_status(bigint, text, uuid[]) from public, anon;
grant execute on function public.report_ready_status(bigint, text, uuid[]) to authenticated, service_role;

commit;
