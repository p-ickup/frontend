import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import { NextResponse } from 'next/server'

const csv = (rows: unknown[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')

const response = (contents: string, filename: string) =>
  new NextResponse(contents, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })

export const GET = withAdminRoute(async (request, auth) => {
  try {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind')
    const start = url.searchParams.get('start') || ''
    const end = url.searchParams.get('end') || ''
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end)
    ) {
      return badRequestJson('A valid export date range is required.')
    }

    if (kind === 'matched') {
      const { data: matches, error } = await auth.supabase
        .from('Matches')
        .select(
          'ride_id, date, time, voucher, is_subsidized, uber_type, flight_id, user_id',
        )
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .order('ride_id', { ascending: true })
      if (error) throw error

      const flightIds = Array.from(
        new Set((matches || []).map((match) => match.flight_id)),
      )
      const userIds = Array.from(
        new Set((matches || []).map((match) => match.user_id)),
      )
      const [flightsResult, usersResult] = await Promise.all([
        flightIds.length
          ? auth.supabase
              .from('Flights')
              .select(
                'flight_id, earliest_time, latest_time, airport, to_airport, airline_iata, flight_no, bag_no_personal, bag_no, bag_no_large',
              )
              .in('flight_id', flightIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? auth.supabase
              .from('Users')
              .select(
                'user_id, firstname, lastname, email, phonenumber, school',
              )
              .in('user_id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (flightsResult.error) throw flightsResult.error
      if (usersResult.error) throw usersResult.error
      const flights = new Map(
        (flightsResult.data || []).map((flight) => [flight.flight_id, flight]),
      )
      const users = new Map(
        (usersResult.data || []).map((user) => [user.user_id, user]),
      )
      const headers = [
        'ride_id',
        'date',
        'time',
        'earliest_time',
        'latest_time',
        'name',
        'email',
        'phonenumber',
        'school',
        'airport',
        'flight',
        'personal_bag',
        'carry_on',
        'checked_bag',
        'voucher',
        'is_subsidized',
        'uber_type',
        'to_airport',
      ]
      return response(
        csv([
          headers,
          ...(matches || []).map((match) => {
            const flight: any = flights.get(match.flight_id)
            const user: any = users.get(match.user_id)
            return [
              match.ride_id,
              match.date,
              match.time,
              flight?.earliest_time,
              flight?.latest_time,
              `${user?.firstname || ''} ${user?.lastname || ''}`.trim(),
              user?.email,
              user?.phonenumber,
              user?.school,
              flight?.airport,
              `${flight?.airline_iata || ''} ${flight?.flight_no || ''}`.trim(),
              flight?.bag_no_personal || 0,
              flight?.bag_no || 0,
              flight?.bag_no_large || 0,
              match.voucher,
              match.is_subsidized || false,
              match.uber_type,
              flight?.to_airport,
            ]
          }),
        ]),
        `matched-${start}-to-${end}.csv`,
      )
    }

    if (kind === 'unmatched') {
      const { data: flights, error } = await auth.supabase
        .from('Flights')
        .select(
          'flight_id, date, earliest_time, latest_time, airport, to_airport, airline_iata, flight_no, bag_no_personal, bag_no, bag_no_large, user_id',
        )
        .in('matching_status', ['submitted', 'unmatched'])
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: true })
        .order('earliest_time', { ascending: true })
        .order('flight_id', { ascending: true })
      if (error) throw error
      const userIds = Array.from(
        new Set(
          (flights || []).map((flight) => flight.user_id).filter(Boolean),
        ),
      )
      const { data: usersData, error: usersError } = userIds.length
        ? await auth.supabase
            .from('Users')
            .select('user_id, school, firstname, lastname, email')
            .in('user_id', userIds)
        : { data: [], error: null }
      if (usersError) throw usersError
      const users = new Map(
        (usersData || []).map((user) => [user.user_id, user]),
      )
      const headers = [
        'flight_id',
        'date',
        'earliest_time',
        'latest_time',
        'school',
        'name',
        'email',
        'user_id',
        'flight',
        'personal_bag',
        'carry_on',
        'checked_bag',
        'airport',
        'to_airport',
      ]
      return response(
        csv([
          headers,
          ...(flights || []).map((flight) => {
            const user: any = users.get(flight.user_id)
            return [
              flight.flight_id,
              flight.date,
              flight.earliest_time,
              flight.latest_time,
              user?.school,
              `${user?.firstname || ''} ${user?.lastname || ''}`.trim(),
              user?.email,
              flight.user_id,
              `${flight.airline_iata || ''} ${flight.flight_no || ''}`.trim(),
              flight.bag_no_personal || 0,
              flight.bag_no || 0,
              flight.bag_no_large || 0,
              flight.airport,
              flight.to_airport,
            ]
          }),
        ]),
        `unmatched-${start}-to-${end}.csv`,
      )
    }

    return badRequestJson('Unsupported export type.')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to generate admin export.')
  }
})
