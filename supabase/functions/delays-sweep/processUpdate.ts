// supabase/functions/delays-sweep/processUpdate.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { escapeHtml } from '../_shared/html.ts'
import { pacificDateTime, pacificToday } from '../_shared/time.ts'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

export type FlightUpdate = {
  airline_iata: string
  flight_no: string | number
  airport: string
  status: string
  dep_estimated_utc?: string
  arr_estimated_utc?: string
  delayed?: number
}

type RideMember = {
  flight_id: number
  date: string
  time: string
  Users: {
    firstname: string | null
    lastname: string | null
    email: string | null
  } | null
}

async function notifyRideGroup(flight_id: number, update: FlightUpdate) {
  try {
    // 1️⃣ Find ALL ride_ids for this flight, but only for future dates
    const { data: flightMatches, error: flightError } = await supabase
      .from('Matches')
      .select('ride_id, date')
      .eq('flight_id', flight_id)
      .gte('date', pacificToday()) // ✅ Only future dates
    if (flightError || !flightMatches || flightMatches.length === 0) {
      console.log('No future ride groups found for flight:', flight_id)
      return
    }
    // 2️⃣ Get unique ride_ids
    const uniqueRideIds = [...new Set(flightMatches.map((m) => m.ride_id))]
    // 3️⃣ Send email for each ride group
    for (const rideId of uniqueRideIds) {
      const { data, error: matchError } = await supabase
        .from('Matches')
        .select(
          `
          ride_id,
          user_id,
          flight_id,
          date,
          time,
          Users(firstname, lastname, email)
        `,
        )
        .eq('ride_id', rideId)
      // Users is a to-one relation, so PostgREST returns an object, not an array
      const matches = data as unknown as RideMember[] | null
      if (matchError || !matches || matches.length === 0) {
        console.log('No users found in ride group:', rideId)
        continue
      }
      // 4️⃣ Check if this ride group is within 1.5 hours
      const rideDate = matches[0].date
      const rideTime = matches[0].time
      const rideDateTime = pacificDateTime(rideDate, rideTime)
      const now = new Date()
      const timeUntilRide = rideDateTime.getTime() - now.getTime()
      const hoursUntilRide = timeUntilRide / (1000 * 60 * 60)
      // Skip if ride is more than 1.5 hours away
      if (hoursUntilRide > 1.5) {
        console.log(
          `Ride group ${rideId} is ${hoursUntilRide.toFixed(1)} hours away - skipping notification`,
        )
        continue
      }
      // 5️⃣ Send email to everyone in this ride group
      const toEmails = matches.map((m) => m.Users?.email).filter(Boolean)
      if (toEmails.length === 0) continue
      // Get the delayed user's name
      const delayedUser = matches.find((m) => m.flight_id === flight_id)?.Users
      const delayedUserName = delayedUser?.firstname || 'a group member'
      // Convert UTC arrival time to PST
      const arrivalTimePST = update.arr_estimated_utc
        ? new Date(update.arr_estimated_utc).toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'TBD'
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2acf80;">Flight Update!</h2>
          <p>There's an update for <strong>${escapeHtml(delayedUserName)}'s</strong> flight ${update.airline_iata} ${update.flight_no}:</p>
          <ul>
            <li>Status: <strong>${update.status}</strong></li>
            <li>Delay: ${update.delayed ?? 0} minutes</li>
            <li>Estimated Arrival: ${arrivalTimePST} PST</li>
          </ul>
          <p>You can google ${update.airline_iata} ${update.flight_no} for more accurate updates.</p>
          
          <h3 style="color: #2acf80;">Group Coordination Guidelines:</h3>
          <p><strong>If your group member is delayed and doesn't show up:</strong></p>
          <ul>
            <li><strong>ONT Airport:</strong> Wait 15 minutes past rideshare departure time, then group can leave</li>
            <li><strong>LAX Airport:</strong> Wait 30 minutes past rideshare departure time, then group can leave</li>
          </ul>
          
          <h3 style="color: #2acf80;">For the Delayed Rider:</h3>
          <p><strong>If you're delayed and miss your group:</strong></p>
          <ul>
            <li><strong>10am–6pm PDT:</strong> Email <a href="mailto:operations@aspc.pomona.edu">operations@aspc.pomona.edu</a> and allow up to 15 minutes for response</li>
            <li><strong>Outside those hours or no response:</strong> Use a contingency voucher (see policies)</li>
            <li><strong>Important:</strong> Submit the <a href="https://p-ickup.com/aspc-info">Delay Verification Form</a> within 24 hours of arrival</li>
          </ul>
          
          <p><strong>These users are in your ride group:</strong></p>
          <ul>
            ${matches.map((m) => `<li>${escapeHtml(`${m.Users?.firstname ?? ''} ${m.Users?.lastname ?? ''}`)}</li>`).join('')}
          </ul>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            For more information, visit: <a href="https://p-ickup.com/aspc-info">https://p-ickup.com/aspc-info</a>
          </p>
        </div>
      `
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PICKUP <match@notify.p-ickup.com>',
          to: toEmails,
          subject: `Flight Update: ${update.airline_iata} ${update.flight_no} - ${delayedUserName}'s Flight`,
          html,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('Resend error:', res.status, text)
      } else {
        console.log(
          `Sent notification to ride group ${rideId} for flight ${flight_id}`,
        )
      }
    }
  } catch (err) {
    console.error('Error notifying ride group:', err)
  }
}
export async function processUpdate(update: FlightUpdate) {
  try {
    // ✅ FILTERED QUERY: Only today's inbound flights
    const { data: flights, error } = await supabase
      .from('Flights')
      .select('*')
      .eq('airline_iata', update.airline_iata)
      .eq('airport', update.airport)
      .eq('flight_no', parseInt(String(update.flight_no), 10))
      .eq('date', pacificToday())
      .eq('to_airport', false)
    if (error) {
      console.error('Lookup error:', error)
      return {
        matched: 0,
      }
    }
    if (!flights || flights.length === 0) {
      return {
        matched: 0,
      }
    }
    const now = new Date()
    let anyUpdated = false
    for (const flight of flights) {
      // ✅ NEW: Only process within 1.5 hours of flight time
      const flightTime = pacificDateTime(flight.date, flight.earliest_time)
      const timeUntilFlight = flightTime.getTime() - now.getTime()
      const hoursUntilFlight = timeUntilFlight / (1000 * 60 * 60)
      // Skip if flight is more than 1.5 hours away
      if (hoursUntilFlight > 1.5) {
        console.log(
          `Flight ${update.flight_no} is ${hoursUntilFlight.toFixed(1)} hours away - skipping entirely`,
        )
        continue
      }
      // ✅ NOW: Check if flight data actually changed (only within 1.5 hours)
      const statusChanged = flight.last_status !== update.status
      const depChanged =
        flight.last_dep_estimated_utc !== update.dep_estimated_utc
      const arrChanged =
        flight.last_arr_estimated_utc !== update.arr_estimated_utc
      const delayChanged =
        flight.last_notified_delay_min === null ||
        (update.delayed ?? 0) - (flight.last_notified_delay_min ?? 0) > 0
      if (!statusChanged && !depChanged && !arrChanged && !delayChanged) {
        continue // skip this flight
      }
      // Determine if we should notify
      const delay = update.delayed ?? 0
      let shouldNotify = false
      if (update.status === 'cancelled' || update.status === 'diverted') {
        shouldNotify = true
      } else if (delay >= (flight.notify_threshold_min ?? 15)) {
        const lastNotified = flight.last_notified_at
          ? new Date(flight.last_notified_at)
          : null
        const cooldownExpired =
          !lastNotified ||
          now.getTime() - lastNotified.getTime() >
            (flight.cooldown_min ?? 45) * 60 * 1000
        const escalatedEnough =
          !flight.last_notified_delay_min ||
          delay - (flight.last_notified_delay_min ?? 0) >=
            (flight.escalate_delta_min ?? 20)
        if (cooldownExpired || escalatedEnough) {
          shouldNotify = true
        }
      }
      // ✅ Update the flight row (only within 1.5 hours)
      await supabase
        .from('Flights')
        .update({
          last_status: update.status,
          last_dep_estimated_utc: update.dep_estimated_utc,
          last_arr_estimated_utc: update.arr_estimated_utc,
          ...(shouldNotify && {
            last_notified_at: now.toISOString(),
            last_notified_delay_min: delay,
          }),
        })
        .eq('flight_id', flight.flight_id)
      anyUpdated = true
      if (shouldNotify) {
        console.log('Sending notification for flight:', update)
        await notifyRideGroup(flight.flight_id, update)
      }
    }
    return {
      matched: flights.length,
      updated: anyUpdated,
    }
  } catch (err) {
    console.error('processUpdate error:', err)
    return {
      matched: 0,
    }
  }
}
