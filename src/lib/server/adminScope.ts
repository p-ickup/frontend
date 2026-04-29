import 'server-only'

type SupabaseClient = any

type AdminProfile = {
  role?: string | null
  admin_scope?: string | null
}

const createScopeError = (message: string, status = 403, details?: unknown) => {
  const error = new Error(message) as Error & {
    status?: number
    details?: unknown
  }
  error.status = status
  error.details = details
  return error
}

const normalizeRole = (role?: string | null) =>
  typeof role === 'string' ? role.trim().toLowerCase() : ''

const isSuperAdmin = (profile: AdminProfile) =>
  normalizeRole(profile.role) === 'super_admin'

const requireAdminScope = (profile: AdminProfile) => {
  if (isSuperAdmin(profile)) return null

  const scope = profile.admin_scope?.trim()
  if (!scope) {
    throw createScopeError('Admin scope is not configured.', 403)
  }

  return scope
}

const getUniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )

const getUniqueNumbers = (values: Array<number | null | undefined>) =>
  Array.from(
    new Set(
      values.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value),
      ),
    ),
  )

const extractScopeTargets = ({
  metadata,
  targetGroupId,
  targetUserId,
}: {
  metadata?: any
  targetGroupId?: number | null
  targetUserId?: string | null
}) => {
  const userIds = getUniqueStrings([
    targetUserId,
    metadata?.target_user_id,
    metadata?.rider_user_id,
    ...(Array.isArray(metadata?.rider_user_ids) ? metadata.rider_user_ids : []),
  ])

  const rideIds = getUniqueNumbers([
    targetGroupId ?? null,
    typeof metadata?.ride_id === 'number'
      ? metadata.ride_id
      : Number(metadata?.ride_id),
    typeof metadata?.from_group === 'number'
      ? metadata.from_group
      : Number(metadata?.from_group),
    typeof metadata?.to_group === 'number'
      ? metadata.to_group
      : Number(metadata?.to_group),
    typeof metadata?.new_ride_id === 'number'
      ? metadata.new_ride_id
      : Number(metadata?.new_ride_id),
  ])

  return { userIds, rideIds }
}

const assertAdminScopeForUsersInternal = async ({
  supabase,
  profile,
  userIds,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  userIds: string[]
}) => {
  if (isSuperAdmin(profile)) return

  const uniqueUserIds = getUniqueStrings(userIds)
  if (uniqueUserIds.length === 0) return

  const scope = requireAdminScope(profile)

  const { data, error } = await supabase
    .from('Users')
    .select('user_id, school')
    .in('user_id', uniqueUserIds)

  if (error) {
    throw createScopeError(error.message, 400, error)
  }

  const rows = data || []
  const foundUserIds = new Set(rows.map((row: any) => row.user_id))

  const missingUserId = uniqueUserIds.find(
    (userId) => !foundUserIds.has(userId),
  )
  if (missingUserId) {
    throw createScopeError('One or more targeted users were not found.', 404, {
      userId: missingUserId,
    })
  }

  const outOfScopeRow = rows.find((row: any) => (row.school ?? '') !== scope)
  if (outOfScopeRow) {
    throw createScopeError(
      'This action includes riders outside your admin scope.',
      403,
      { userId: outOfScopeRow.user_id },
    )
  }
}

const getFlightsForScopeValidation = async ({
  supabase,
  flightIds,
}: {
  supabase: SupabaseClient
  flightIds: number[]
}) => {
  const uniqueFlightIds = getUniqueNumbers(flightIds)
  if (uniqueFlightIds.length === 0) return []

  const { data, error } = await supabase
    .from('Flights')
    .select('flight_id, user_id')
    .in('flight_id', uniqueFlightIds)

  if (error) {
    throw createScopeError(error.message, 400, error)
  }

  const rows = data || []
  const foundFlightIds = new Set(rows.map((row: any) => row.flight_id))

  const missingFlightId = uniqueFlightIds.find(
    (flightId) => !foundFlightIds.has(flightId),
  )
  if (missingFlightId != null) {
    throw createScopeError(
      'One or more targeted flights were not found.',
      404,
      {
        flightId: missingFlightId,
      },
    )
  }

  return rows as Array<{ flight_id: number; user_id: string }>
}

const assertRideScopeByRideIds = async ({
  supabase,
  profile,
  rideIds,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  rideIds: number[]
}) => {
  if (isSuperAdmin(profile)) return

  for (const rideId of getUniqueNumbers(rideIds)) {
    const { data, error } = await supabase
      .from('Matches')
      .select('flight_id')
      .eq('ride_id', rideId)

    if (error) {
      throw createScopeError(error.message, 400, error)
    }

    const matches = data || []
    if (matches.length === 0) {
      throw createScopeError(
        'One or more targeted groups were not found.',
        404,
        {
          rideId,
        },
      )
    }

    await assertAdminScopeForFlights({
      supabase,
      profile,
      flightIds: matches.map((match: any) => Number(match.flight_id)),
    })
  }
}

export async function assertAdminScopeForUser({
  supabase,
  profile,
  userId,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  userId: string
}) {
  await assertAdminScopeForUsersInternal({
    supabase,
    profile,
    userIds: [userId],
  })
}

export async function assertAdminScopeForUsers({
  supabase,
  profile,
  userIds,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  userIds: string[]
}) {
  await assertAdminScopeForUsersInternal({ supabase, profile, userIds })
}

export async function assertAdminScopeForFlight({
  supabase,
  profile,
  flightId,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  flightId: number
}) {
  await assertAdminScopeForFlights({
    supabase,
    profile,
    flightIds: [flightId],
  })
}

export async function assertAdminScopeForFlights({
  supabase,
  profile,
  flightIds,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  flightIds: number[]
}) {
  if (isSuperAdmin(profile)) return

  const rows = await getFlightsForScopeValidation({ supabase, flightIds })
  await assertAdminScopeForUsersInternal({
    supabase,
    profile,
    userIds: rows.map((row) => row.user_id),
  })
}

export async function assertAdminScopeForRide({
  supabase,
  profile,
  rideId,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  rideId: number
}) {
  await assertRideScopeByRideIds({
    supabase,
    profile,
    rideIds: [rideId],
  })
}

export async function assertAdminScopeForUserFlightPair({
  supabase,
  profile,
  userId,
  flightId,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  userId: string
  flightId: number
}) {
  const rows = await getFlightsForScopeValidation({
    supabase,
    flightIds: [flightId],
  })

  const flight = rows[0]
  if (!flight || flight.user_id !== userId) {
    throw createScopeError(
      'The selected flight does not belong to the targeted rider.',
      400,
      { flightId, userId },
    )
  }

  await assertAdminScopeForUsersInternal({
    supabase,
    profile,
    userIds: [userId],
  })
}

export async function assertAdminScopeForChangeLogPayload({
  supabase,
  profile,
  metadata,
  targetGroupId,
  targetUserId,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  metadata?: any
  targetGroupId?: number | null
  targetUserId?: string | null
}) {
  if (isSuperAdmin(profile)) return

  const { userIds, rideIds } = extractScopeTargets({
    metadata,
    targetGroupId,
    targetUserId,
  })

  if (userIds.length > 0) {
    await assertAdminScopeForUsersInternal({
      supabase,
      profile,
      userIds,
    })
  }

  let validatedRideScope = false
  for (const rideId of rideIds) {
    try {
      await assertRideScopeByRideIds({
        supabase,
        profile,
        rideIds: [rideId],
      })
      validatedRideScope = true
    } catch (error: any) {
      if (error?.status === 404 && userIds.length > 0) {
        continue
      }
      throw error
    }
  }

  if (userIds.length === 0 && !validatedRideScope) {
    throw createScopeError(
      'This change log action cannot be validated against your admin scope.',
      403,
    )
  }
}

export async function assertAdminScopeForChangeLogIds({
  supabase,
  profile,
  changeLogIds,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  changeLogIds: string[]
}) {
  if (isSuperAdmin(profile)) return

  const uniqueIds = getUniqueStrings(changeLogIds)
  if (uniqueIds.length === 0) return

  const { data, error } = await supabase
    .from('ChangeLog')
    .select('id, target_user_id, target_group_id, metadata')
    .in('id', uniqueIds)

  if (error) {
    throw createScopeError(error.message, 400, error)
  }

  const entries = data || []
  const foundIds = new Set(entries.map((entry: any) => entry.id))
  const missingId = uniqueIds.find((id) => !foundIds.has(id))
  if (missingId) {
    throw createScopeError(
      'One or more change log entries were not found.',
      404,
      {
        id: missingId,
      },
    )
  }

  for (const entry of entries as Array<{
    id: string
    metadata?: any
    target_group_id?: number | null
    target_user_id?: string | null
  }>) {
    await assertAdminScopeForChangeLogPayload({
      supabase,
      profile,
      metadata: entry.metadata,
      targetGroupId:
        typeof entry.target_group_id === 'number'
          ? entry.target_group_id
          : null,
      targetUserId: entry.target_user_id ?? null,
    })
  }
}
