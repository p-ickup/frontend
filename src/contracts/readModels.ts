interface ResultUserDto {
  user_id: string
  firstname: string | null
  lastname: string | null
  phonenumber: string | null
  photo_url: string | null
  email: string | null
}

interface ResultFlightDto {
  airport: string
  date: string
  to_airport: boolean
}

export interface ResultMatchDto {
  ride_id: number
  user_id: string
  date: string | null
  time: string | null
  voucher: string | null
  contingency_voucher: string | null
  uber_type: string | null
  ready_for_pickup_at: string | null
  reported_missing_user_ids: string[] | null
  group_ready_at: string | null
  Flights: ResultFlightDto
  Users: ResultUserDto
}

export interface ResultsResponseDto {
  success: true
  matches: ResultMatchDto[]
}

interface ReadyGroupResultDto {
  rideId: number
  updated: boolean
  groupReadyAt: string | null
}

export interface MarkGroupsReadyResponseDto {
  success: true
  results: ReadyGroupResultDto[]
}

export interface UnmatchedUserDto {
  firstname: string | null
  lastname: string | null
  email: string | null
}

export interface UnmatchedFlightDto {
  flight_id: number
  user_id: string
  airport: string
  date: string
  earliest_time: string
  latest_time: string
  to_airport: boolean
  opt_in: boolean
  Users: UnmatchedUserDto | null
}

export interface OwnUnmatchedFlightDto {
  flight_id: number
  airport: string
  date: string
  earliest_time: string
  latest_time: string
}

export interface UnmatchedGroupDto {
  ride_id: number
  flights: UnmatchedFlightDto[]
  time: string | null
}

export interface UnmatchedOptionsResponseDto {
  success: true
  flights: UnmatchedFlightDto[]
  groups: UnmatchedGroupDto[]
  myFlights: OwnUnmatchedFlightDto[]
  userEligible: boolean
}

export interface ProfileCompletenessDto {
  firstname: string | null
  lastname: string | null
  school: string | null
  email: string | null
  phonenumber: string | null
}

export interface AdminSummaryDto {
  school: string
  matchRate: number
  matchedRiders: number
  totalRiders: number
  unmatchedFlightsCount: number
  algorithmLastRan: string
  lastRunStatus: string
  nextScheduledRunDate: string
  nextScheduledRunTarget: string
}

export interface AdminGroupRiderDto {
  user_id: string
  flight_id: number
  name: string
  phone: string
  checked_bags: number
  carry_on_bags: number
  time_range: string
  airport: string
  to_airport: boolean
  date: string
  reason?: string
  flight_no?: string
  airline_iata?: string
  originGroupId?: number
  originType?: 'unmatched' | 'group'
  school?: string
  original_unmatched?: boolean
  no_show?: unknown
}

export interface AdminGroupRowDto {
  ride_id: number
  airport: string
  date: string
  time_range: string
  match_time?: string
  to_airport: boolean
  riders: AdminGroupRiderDto[]
  recommended_time?: string
  group_voucher?: string
  uber_type?: string | null
  is_subsidized?: boolean | null
  subsidized_override?: boolean
  uber_type_override?: boolean
}

export interface AdminGroupsSnapshotResponseDto {
  adminScope: string | null
  availableAirports: string[]
  groups: AdminGroupRowDto[]
  unmatchedRiders: AdminGroupRiderDto[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
  dateRangeStart: string
  dateRangeEnd: string
  lastAlgorithmRunDate: string
}

const firstRelated = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null

export const toResultMatchDto = (row: any): ResultMatchDto => {
  const flight = firstRelated<any>(row.Flights)
  const user = firstRelated<any>(row.Users)

  return {
    ride_id: row.ride_id,
    user_id: row.user_id,
    date: row.date ?? null,
    time: row.time ?? null,
    voucher: row.voucher ?? null,
    contingency_voucher: row.contingency_voucher ?? null,
    uber_type: row.uber_type ?? null,
    ready_for_pickup_at: row.ready_for_pickup_at ?? null,
    reported_missing_user_ids: row.reported_missing_user_ids ?? null,
    group_ready_at: row.group_ready_at ?? null,
    Flights: {
      airport: flight?.airport || '',
      date: flight?.date || '',
      to_airport: Boolean(flight?.to_airport),
    },
    Users: {
      user_id: user?.user_id || row.user_id || '',
      firstname: user?.firstname ?? null,
      lastname: user?.lastname ?? null,
      phonenumber: user?.phonenumber ?? null,
      photo_url: user?.photo_url ?? null,
      email: user?.email ?? null,
    },
  }
}

export const toResultsResponseDto = (result: any): ResultsResponseDto => ({
  success: true,
  matches: (result?.matches || []).map(toResultMatchDto),
})

const toUnmatchedUserDto = (row: any): UnmatchedUserDto | null => {
  const user = firstRelated<any>(row)
  if (!user) return null

  return {
    firstname: user.firstname ?? null,
    lastname: user.lastname ?? null,
    email: user.email ?? null,
  }
}

export const toUnmatchedFlightDto = (row: any): UnmatchedFlightDto => ({
  flight_id: row.flight_id,
  user_id: row.user_id || '',
  airport: row.airport || '',
  date: row.date || '',
  earliest_time: row.earliest_time || '',
  latest_time: row.latest_time || '',
  to_airport: Boolean(row.to_airport),
  opt_in: Boolean(row.opt_in),
  Users: toUnmatchedUserDto(row.Users),
})

export const toOwnUnmatchedFlightDto = (row: any): OwnUnmatchedFlightDto => ({
  flight_id: row.flight_id,
  airport: row.airport || '',
  date: row.date || '',
  earliest_time: row.earliest_time || '',
  latest_time: row.latest_time || '',
})

export const toUnmatchedOptionsResponseDto = (
  result: any,
): UnmatchedOptionsResponseDto => ({
  success: true,
  flights: (result?.flights || []).map(toUnmatchedFlightDto),
  groups: (result?.groups || []).map((group: any) => ({
    ride_id: group.ride_id,
    flights: (group.flights || []).map(toUnmatchedFlightDto),
    time: group.time ?? null,
  })),
  myFlights: (result?.myFlights || []).map(toOwnUnmatchedFlightDto),
  userEligible: Boolean(result?.userEligible),
})

export const toProfileCompletenessDto = (row: any): ProfileCompletenessDto => ({
  firstname: row.firstname ?? null,
  lastname: row.lastname ?? null,
  school: row.school ?? null,
  email: row.email ?? null,
  phonenumber: row.phonenumber ?? null,
})

export const toAdminSummaryDto = (row: AdminSummaryDto): AdminSummaryDto => ({
  school: row.school,
  matchRate: row.matchRate,
  matchedRiders: row.matchedRiders,
  totalRiders: row.totalRiders,
  unmatchedFlightsCount: row.unmatchedFlightsCount,
  algorithmLastRan: row.algorithmLastRan,
  lastRunStatus: row.lastRunStatus,
  nextScheduledRunDate: row.nextScheduledRunDate,
  nextScheduledRunTarget: row.nextScheduledRunTarget,
})

const toAdminGroupRiderDto = (
  rider: AdminGroupRiderDto,
): AdminGroupRiderDto => ({
  user_id: rider.user_id,
  flight_id: rider.flight_id,
  name: rider.name,
  phone: rider.phone,
  checked_bags: rider.checked_bags,
  carry_on_bags: rider.carry_on_bags,
  time_range: rider.time_range,
  airport: rider.airport,
  to_airport: rider.to_airport,
  date: rider.date,
  ...(rider.reason === undefined ? {} : { reason: rider.reason }),
  ...(rider.flight_no === undefined ? {} : { flight_no: rider.flight_no }),
  ...(rider.airline_iata === undefined
    ? {}
    : { airline_iata: rider.airline_iata }),
  ...(rider.originGroupId === undefined
    ? {}
    : { originGroupId: rider.originGroupId }),
  ...(rider.originType === undefined ? {} : { originType: rider.originType }),
  ...(rider.school === undefined ? {} : { school: rider.school }),
  ...(rider.original_unmatched === undefined
    ? {}
    : { original_unmatched: rider.original_unmatched }),
  ...(rider.no_show === undefined ? {} : { no_show: rider.no_show }),
})

export const toAdminGroupRowDto = (
  group: AdminGroupRowDto,
): AdminGroupRowDto => ({
  ride_id: group.ride_id,
  airport: group.airport,
  date: group.date,
  time_range: group.time_range,
  ...(group.match_time === undefined ? {} : { match_time: group.match_time }),
  to_airport: group.to_airport,
  riders: group.riders.map(toAdminGroupRiderDto),
  ...(group.recommended_time === undefined
    ? {}
    : { recommended_time: group.recommended_time }),
  ...(group.group_voucher === undefined
    ? {}
    : { group_voucher: group.group_voucher }),
  ...(group.uber_type === undefined ? {} : { uber_type: group.uber_type }),
  ...(group.is_subsidized === undefined
    ? {}
    : { is_subsidized: group.is_subsidized }),
  ...(group.subsidized_override === undefined
    ? {}
    : { subsidized_override: group.subsidized_override }),
  ...(group.uber_type_override === undefined
    ? {}
    : { uber_type_override: group.uber_type_override }),
})

export const toAdminGroupsSnapshotResponseDto = (
  snapshot: AdminGroupsSnapshotResponseDto,
): AdminGroupsSnapshotResponseDto => ({
  adminScope: snapshot.adminScope,
  availableAirports: [...snapshot.availableAirports],
  groups: snapshot.groups.map(toAdminGroupRowDto),
  unmatchedRiders: snapshot.unmatchedRiders.map(toAdminGroupRiderDto),
  pagination: {
    page: snapshot.pagination.page,
    pageSize: snapshot.pagination.pageSize,
    totalRecords: snapshot.pagination.totalRecords,
    totalPages: snapshot.pagination.totalPages,
  },
  dateRangeStart: snapshot.dateRangeStart,
  dateRangeEnd: snapshot.dateRangeEnd,
  lastAlgorithmRunDate: snapshot.lastAlgorithmRunDate,
})
