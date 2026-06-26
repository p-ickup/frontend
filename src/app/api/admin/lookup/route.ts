import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import { NextResponse } from 'next/server'

export const GET = withAdminRoute(async (request, auth) => {
  try {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind')

    if (kind === 'schools') {
      const { data, error } = await auth.supabase
        .from('Users')
        .select('school')
        .not('school', 'is', null)
        .neq('school', '')

      if (error) throw error
      return NextResponse.json({
        schools: Array.from(
          new Set(
            (data || [])
              .map((user) => user.school)
              .filter((school): school is string => Boolean(school)),
          ),
        ).sort(),
      })
    }

    if (kind === 'users') {
      const school = url.searchParams.get('school')?.trim()
      if (!school) return badRequestJson('School is required.')

      const { data, error } = await auth.supabase
        .from('Users')
        .select(
          'user_id, firstname, lastname, school, email, phonenumber, sms_opt_in',
        )
        .eq('school', school)
        .order('firstname')
        .order('lastname')

      if (error) throw error
      return NextResponse.json({ users: data || [] })
    }

    if (kind === 'flight-exists') {
      const userId = url.searchParams.get('userId')?.trim()
      const flightNo = url.searchParams.get('flightNo')?.trim()
      const date = url.searchParams.get('date')?.trim()
      if (!userId || !flightNo || !date) {
        return badRequestJson('User, flight number, and date are required.')
      }

      const { count, error } = await auth.supabase
        .from('Flights')
        .select('flight_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('flight_no', flightNo)
        .eq('date', date)

      if (error) throw error
      return NextResponse.json({ exists: (count || 0) > 0 })
    }

    if (kind === 'contacts') {
      const userIds = Array.from(
        new Set(
          url.searchParams
            .getAll('userId')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      )
      if (userIds.length === 0 || userIds.length > 100) {
        return badRequestJson('Between 1 and 100 user IDs are required.')
      }

      const { data, error } = await auth.supabase
        .from('Users')
        .select('user_id, email, phonenumber, sms_opt_in')
        .in('user_id', userIds)

      if (error) throw error
      return NextResponse.json({ contacts: data || [] })
    }

    if (kind === 'rider') {
      const flightId = Number(url.searchParams.get('flightId'))
      if (!Number.isFinite(flightId)) {
        return badRequestJson('A valid flight ID is required.')
      }

      const { data: flight, error: flightError } = await auth.supabase
        .from('Flights')
        .select(
          'flight_id, user_id, flight_no, airline_iata, airport, to_airport, date, earliest_time, latest_time, original_unmatched',
        )
        .eq('flight_id', flightId)
        .single()
      if (flightError) throw flightError

      const { data: user, error: userError } = await auth.supabase
        .from('Users')
        .select('firstname, lastname')
        .eq('user_id', flight.user_id)
        .single()
      if (userError) throw userError

      return NextResponse.json({
        rider: {
          user_id: flight.user_id,
          flight_id: flight.flight_id,
          name: `${user.firstname} ${user.lastname}`.trim(),
          phone: '',
          checked_bags: 0,
          carry_on_bags: 0,
          time_range:
            flight.earliest_time && flight.latest_time
              ? `${flight.earliest_time} - ${flight.latest_time}`
              : '',
          airport: flight.airport || '',
          to_airport: flight.to_airport ?? true,
          date: flight.date || '',
          flight_no: flight.flight_no || '',
          airline_iata: flight.airline_iata || '',
          original_unmatched: flight.original_unmatched ?? false,
        },
      })
    }

    return badRequestJson('Unsupported admin lookup.')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load admin lookup data.')
  }
})
