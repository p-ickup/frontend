import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FOR TESTING, ADD IS_VERFIED BACK INTO QUERY

// Sends match emails. When ride_ids provided (admin "Email group"), sends to all in group (ignores email_sent).
// Otherwise (bulk send), only sends to matches with email_sent = false.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const TURQ = '#06b6d4'
const BATCH_SIZE = 100 // Resend batch limit

/**
 * Derive is_subsidized from voucher/uber_type instead of database.
 * Subsidized = has voucher OR uber_type is Connect
 */
function deriveIsSubsidized(match: {
  voucher?: string | null
  uber_type?: string | null
}): boolean {
  return (
    Boolean(match.voucher?.trim()) ||
    match.uber_type?.toLowerCase() === 'connect'
  )
}

function toAmPm(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  const [hourStr, minuteStr] = timeStr.split(':')
  let hour = parseInt(hourStr, 10)
  const minute = minuteStr.padStart(2, '0')
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

/** Safely extract nested relation - Supabase may return object or array */
function getRelation<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

// COMMENTED OUT: Group display not working - using simple "view at p-ickup.com/results" box instead
// function renderGroupList(members: any[], excludeUserId: string): string {
//   if (!members || members.length === 0) return '<li>No other group members found.</li>';
//
//   const filteredMembers = members.filter(m => m.user_id !== excludeUserId);
//
//   return filteredMembers.map((member) => {
//     const memberUser = getRelation(member.Users ?? member.users);
//     const email = memberUser?.email || '';
//     const phone = memberUser?.phonenumber || '';
//     const contact = [email, phone].filter(Boolean).join(' · ');
//
//     return `
//       <li style="margin-bottom: 10px;">
//         <strong>${memberUser?.firstname || ''} ${memberUser?.lastname || ''}</strong><br>
//         <small>${contact}</small>
//       </li>
//     `;
//   }).join('');
// }

const GROUP_BOX_HTML = `
  <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #06b6d4;">YOUR GROUP CAN BE VIEWED AT:</h3>
    <p style="margin: 0;"><a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></p>
  </div>
`

/**
 * Update email template — used when admin sends via "Email group" (ride_ids provided).
 * Simple message: group was updated, view results for latest info.
 */
function generateUpdateEmailHtml(
  firstName: string,
  rideDate: string,
  rideTime: string,
  airport: string,
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
      <p>Your ride group was updated.</p>
      <p>View <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a> for the most up-to-date info.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Ride Details</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Date:</strong> ${rideDate}</li>
          <li><strong>Time:</strong> ${rideTime}</li>
          <li><strong>Airport:</strong> ${airport}</li>
        </ul>
      </div>
      <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
    </div>
  `
}

/**
 * EMAIL LOGIC:
 *
 * There are 4 email variants based on:
 * 1. uber_type = Connect - Connect Shuttles (shuttle, no voucher)
 * 2. is_subsidized (derived: has voucher OR uber_type=Connect) - Is the ride covered by ASPC?
 * 3. to_airport (boolean) - Is it going TO airport or FROM airport?
 *
 * Variants:
 * - Connect Shuttles TO airport (uber_type=Connect, to_airport=true) - ONLY this combo
 * - Subsidized TO airport (is_subsidized=true, to_airport=true, not Connect)
 * - Subsidized FROM airport (is_subsidized=true, to_airport=false)
 * - Unsubsidized (is_subsidized=false)
 */

function generateEmailHtml(
  isSubsidized: boolean,
  toAirport: boolean,
  isConnect: boolean,
  firstName: string,
  rideDate: string,
  rideTime: string,
  airport: string,
  groupMembersHtml: string,
  voucher: string | null,
  contingencyVoucher: string | null,
): string {
  // Variant 0: Connect Shuttles TO airport (ONLY to_airport=true + uber_type=Connect)
  if (isConnect && toAirport) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
        <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
        <p>Your ride will be served by a Connect Shuttles partner vehicle.</p>
        <p>Please review your ride details below:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">
            <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
          </h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date:</strong> ${rideDate}</li>
            <li><strong>Time:</strong> ${rideTime}</li>
            <li><strong>Airport:</strong> ${airport}</li>
          </ul>
        </div>
        <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above. The shuttle will depart promptly at the listed time.</p>
        ${GROUP_BOX_HTML}
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
          <h4 style="margin-top: 0; color: #0c4a6e;">Boarding Instructions</h4>
          <p>This ride will be served by Connect Shuttles' local partners.</p>
          <ul style="margin: 12px 0 0; padding-left: 20px;">
            <li>A shuttle vehicle will arrive at the pickup location at least 10 minutes before departure.</li>
            <li>No voucher or ride request is required.</li>
            <li>Simply meet your group, provide your name to the driver, and board the shuttle when it arrives.</li>
            <li>To keep the schedule on time, the shuttle will depart promptly at the listed time.</li>
          </ul>
        </div>
        <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
          <ul style="margin: 12px 0 0; padding-left: 20px;">
            <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
            <li><strong>Student-initiated cancellations</strong> after the matching deadline may incur a cancellation fee.</li>
            <li>To avoid a no-show fee, you must notify RideLink or submit the cancellation form at least 1 hour before your scheduled ride.</li>
          </ul>
        </div>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
        <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
      </div>
    `
  }

  // Variant 1: Subsidized TO Airport (voucher-based, not Connect)
  if (isSubsidized && toAirport) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
        <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
        <p>Please review your ride details below:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">
            <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
          </h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date:</strong> ${rideDate}</li>
            <li><strong>Time:</strong> ${rideTime}</li>
            <li><strong>Airport:</strong> ${airport}</li>
          </ul>
        </div>
        <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>
        ${GROUP_BOX_HTML}
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
          <h4 style="margin-top: 0; color: #0c4a6e;">Accessing your voucher</h4>
          <p>When your group meets and is ready to leave:</p>
          <ul style="margin: 12px 0 0; padding-left: 20px;">
            <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
            <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
            <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group. Add stops if your group needs to go to multiple terminals.</li>
            <li>The ride will be automatically billed to ASPC through the voucher.</li>
          </ul>
        </div>
        <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
          <ul style="margin: 12px 0 0; padding-left: 20px;">
            <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
            <li>If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></li>
            <li>To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</li>
          </ul>
        </div>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
        <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
      </div>
    `
  }

  // Variant 2: Subsidized FROM Airport (return trip)
  if (isSubsidized && !toAirport) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
        <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
        <p>Please review your ride details below:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">
            <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
          </h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date:</strong> ${rideDate}</li>
            <li><strong>Time:</strong> ${rideTime}</li>
            <li><strong>Airport:</strong> ${airport}</li>
          </ul>
        </div>
        <h4 style="margin-top: 12px;">Meeting Point:</h4>
        <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
        <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
        ${GROUP_BOX_HTML}
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
          <h4 style="margin-top: 0; color: #0c4a6e;">Voucher — Accessing your voucher</h4>
          <p>When your group meets and is ready to leave:</p>
          <ul style="margin: 12px 0 0; padding-left: 20px;">
            <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
            <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
            <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group.</li>
            <li>The ride will be automatically billed to ASPC through the voucher.</li>
          </ul>
          <p style="margin-top: 12px; font-size: 14px;"><strong>Reminder:</strong> If a rider is missing at ride time, mark them as missing in the checklist so the rest of the group can still access the voucher.</p>
        </div>
        <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <h4 style="margin-top: 0;">Flight Delays & Contingency Vouchers</h4>
          <p>Airline-initiated delays or cancellations are always covered.</p>
          <p><strong>If your flight is delayed:</strong></p>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            <li>Complete the Delay Form at <a href="https://p-ickup.com/aspc-delay" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-delay</a> as soon as possible</li>
            <li>PICKUP will automatically: confirm regrouping and provide new group information, or issue a contingency voucher</li>
          </ul>
          <p style="margin-top: 12px;">Contingency vouchers and regrouping is only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
          <p style="margin-top: 12px;">If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>. To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</p>
        </div>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
        <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
      </div>
    `
  }

  // Variant 3: Unsubsidized
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
      <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">
          <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
        </h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Date:</strong> ${rideDate}</li>
          <li><strong>Time:</strong> ${rideTime}</li>
          <li><strong>Airport:</strong> ${airport}</li>
        </ul>
      </div>
      ${GROUP_BOX_HTML}
      <p>We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.</p>
      <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>
      <p>If you have any questions about ASPC's Airport Rideshare program, please contact <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or view ASPC info page at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.</p>
      <p>Safe travels,<br>The P-ICKUP Team<br></p>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
        Deno.env.get('SUPABASE_ANON_KEY') ??
        '',
    )

    const { dry_run, ride_ids, date_start, date_end } = await req
      .json()
      .catch(() => ({}))

    // Fetch matches. When ride_ids provided (admin "Email group"), include all matches.
    // Otherwise (bulk send), only include matches that haven't been emailed yet.
    // is_subsidized derived from voucher/uber_type, not from DB
    let query = supabase.from('Matches').select(`
        user_id,
        ride_id,
        flight_id,
        voucher,
        contingency_voucher,
        uber_type,
        date,
        time,
        is_verified,
        email_sent,
        Users(firstname, lastname, email, phonenumber),
        Flights(date, airport, earliest_time, latest_time, to_airport)
      `)
    //.eq('is_verified', true); // FOR TESTING

    if (ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0) {
      query = query.in('ride_id', ride_ids)
      // Admin "Email group": send to everyone in the group, ignore email_sent
    } else {
      query = query.or('email_sent.is.null,email_sent.eq.false')
    }
    if (date_start) {
      query = query.gte('date', date_start)
    }
    if (date_end) {
      query = query.lte('date', date_end)
    }

    const { data: allMatches, error: matchesError } = await query

    if (matchesError) {
      throw new Error(`Failed to fetch matches: ${matchesError.message}`)
    }

    if (!allMatches || allMatches.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No matches found that need emails sent',
          sent: 0,
          failed: 0,
          total: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log(`Processing ${allMatches.length} matches for email sending...`)

    const isUpdateEmail =
      ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0

    // Group matches by ride_id for efficient processing
    const matchesByRide = new Map<number, typeof allMatches>()
    for (const match of allMatches) {
      const rideId = match.ride_id
      if (!matchesByRide.has(rideId)) {
        matchesByRide.set(rideId, [])
      }
      matchesByRide.get(rideId)!.push(match)
    }

    // Prepare all emails
    const emailBatch: any[] = []
    const matchMetadata: Array<{ user_id: string; ride_id: number }> = []

    for (const [rideId, rideMatches] of matchesByRide.entries()) {
      const firstMatch = rideMatches[0]
      const flightData = getRelation(firstMatch.Flights)
      const toAirport = flightData?.to_airport ?? false

      for (const match of rideMatches) {
        const user = getRelation(match.Users)
        if (!user?.email) {
          console.warn(`Skipping match - no email for user ${match.user_id}`)
          continue
        }

        const rideDate = match.date ?? flightData?.date ?? ''
        const rideTime = match.time ? toAmPm(match.time) : ''
        const airport = flightData?.airport ?? ''
        const isSubsidized = deriveIsSubsidized(match)
        const isConnect = match.uber_type?.toLowerCase() === 'connect'

        const subject = isUpdateEmail
          ? 'PICKUP — Your ride group was updated'
          : isSubsidized
            ? 'PICKUP — Your ASPC-subsidized ride group!'
            : 'PICKUP — Your ride group!'

        const emailHtml = isUpdateEmail
          ? generateUpdateEmailHtml(
              user.firstname || 'there',
              rideDate,
              rideTime,
              airport,
            )
          : generateEmailHtml(
              isSubsidized,
              toAirport,
              isConnect,
              user.firstname || 'there',
              rideDate,
              rideTime,
              airport,
              '',
              match.voucher,
              match.contingency_voucher,
            )

        emailBatch.push({
          from: 'PICKUP <match@notify.p-ickup.com>',
          to: [user.email],
          cc: ['ridelink@aspc.pomona.edu'],
          subject: subject,
          html: emailHtml,
          reply_to: ['pickup.pai.47@gmail.com', 'ridelink@aspc.pomona.edu'],
        })

        matchMetadata.push({
          user_id: match.user_id,
          ride_id: match.ride_id,
        })
      }
    }

    if (emailBatch.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No emails to send (missing email addresses)',
          sent: 0,
          failed: 0,
          total: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dry run - no emails sent',
          would_send: emailBatch.length,
          preview: emailBatch.slice(0, 3).map((e) => ({
            to: e.to,
            subject: e.subject,
          })),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Send emails in batches of 100
    const successfulMatches: Array<{ user_id: string; ride_id: number }> = []
    const failedMatches: Array<{ user_id: string; ride_id: number }> = []
    let totalSent = 0

    for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
      const batch = emailBatch.slice(i, i + BATCH_SIZE)
      const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE)

      try {
        const emailResponse = await fetch(
          'https://api.resend.com/emails/batch',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
          },
        )

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
            errorText,
          )

          for (const meta of batchMetadata) {
            failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id })
          }
          continue
        }

        const batchResult = await emailResponse.json()
        const sentIds = batchResult.data || []

        if (sentIds.length === batch.length) {
          for (const meta of batchMetadata) {
            successfulMatches.push({
              user_id: meta.user_id,
              ride_id: meta.ride_id,
            })
            totalSent++
          }
          console.log(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: Sent ${sentIds.length} emails`,
          )
        } else {
          for (let j = 0; j < sentIds.length; j++) {
            successfulMatches.push({
              user_id: batchMetadata[j].user_id,
              ride_id: batchMetadata[j].ride_id,
            })
            totalSent++
          }
          for (let j = sentIds.length; j < batchMetadata.length; j++) {
            failedMatches.push({
              user_id: batchMetadata[j].user_id,
              ride_id: batchMetadata[j].ride_id,
            })
          }
          console.warn(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: Partial success - ${sentIds.length}/${batch.length} emails sent`,
          )
        }
      } catch (error) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error)
        for (const meta of batchMetadata) {
          failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id })
        }
      }
    }

    // Mark emails as sent for successful sends
    let updatedCount = 0
    let errorCount = 0

    if (successfulMatches.length > 0) {
      console.log(
        `Attempting to update ${successfulMatches.length} matches as email_sent = true`,
      )

      for (const match of successfulMatches) {
        const { data, error: updateError } = await supabase
          .from('Matches')
          .update({ email_sent: true })
          .eq('user_id', match.user_id)
          .eq('ride_id', match.ride_id)
          .select()

        if (updateError) {
          errorCount++
          console.error(
            `Failed to update email_sent for user ${match.user_id}, ride ${match.ride_id}:`,
            {
              error: updateError.message,
              code: updateError.code,
              details: updateError.details,
            },
          )
        } else if (data && data.length > 0) {
          updatedCount++
        } else {
          errorCount++
          console.warn(
            `No rows updated for user ${match.user_id}, ride ${match.ride_id} - check if row exists with matching criteria`,
          )
        }
      }

      if (updatedCount > 0) {
        console.log(
          `✅ Successfully marked ${updatedCount} matches as email_sent = true`,
        )
      }

      if (errorCount > 0) {
        console.error(
          `❌ Failed to update ${errorCount} matches - check logs above`,
        )
      }

      if (updatedCount === 0 && errorCount === 0) {
        console.warn(`⚠️ No matches were updated - possible issues:
          - email_sent column may not exist (run migration)
          - Matches may already have email_sent = true
          - Row may not match criteria (user_id, ride_id)`)
      }
    } else {
      console.warn(
        'No successful matches to update - no emails were sent successfully',
      )
    }

    // Verify updates were successful - check a sample
    let verifiedCount = 0
    if (successfulMatches.length > 0) {
      const sampleSize = Math.min(5, successfulMatches.length)
      for (let i = 0; i < sampleSize; i++) {
        const match = successfulMatches[i]
        const { data } = await supabase
          .from('Matches')
          .select('email_sent')
          .eq('user_id', match.user_id)
          .eq('ride_id', match.ride_id)
          .single()

        if (data?.email_sent === true) {
          verifiedCount++
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Batch email sending complete',
        sent: totalSent,
        failed: failedMatches.length,
        total: emailBatch.length,
        successful_matches_count: successfulMatches.length,
        database_updated_count: updatedCount,
        verified_sample: verifiedCount,
        successful_matches: successfulMatches,
        failed_matches: failedMatches,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in send-all-match-emails-batch:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// // sends emails to people who is_verified = TRUE and email_sent = FALSE

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
// };

// const TURQ = "#06b6d4";
// const BATCH_SIZE = 100; // Resend batch limit

// /**
//  * Derive is_subsidized from voucher/uber_type instead of database.
//  * Subsidized = has voucher OR uber_type is Connect
//  */
// function deriveIsSubsidized(match: { voucher?: string | null; uber_type?: string | null }): boolean {
//   return Boolean(match.voucher?.trim()) || match.uber_type?.toLowerCase() === 'connect';
// }

// function toAmPm(timeStr: string | null | undefined): string {
//   if (!timeStr) return "";
//   const [hourStr, minuteStr] = timeStr.split(":");
//   let hour = parseInt(hourStr, 10);
//   const minute = minuteStr.padStart(2, "0");
//   const ampm = hour >= 12 ? "PM" : "AM";
//   hour = hour % 12 || 12;
//   return `${hour}:${minute} ${ampm}`;
// }

// /** Safely extract nested relation - Supabase may return object or array */
// function getRelation<T>(data: T | T[] | null | undefined): T | null {
//   if (!data) return null;
//   return Array.isArray(data) ? data[0] ?? null : data;
// }

// const GROUP_BOX_HTML = `
//   <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//     <h3 style="margin-top: 0; color: #06b6d4;">YOUR GROUP CAN BE VIEWED AT:</h3>
//     <p style="margin: 0;"><a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></p>
//   </div>
// `;

// /**
//  * EMAIL LOGIC:
//  *
//  * There are 4 email variants based on:
//  * 1. uber_type = Connect - Connect Shuttles (shuttle, no voucher)
//  * 2. is_subsidized (derived: has voucher OR uber_type=Connect) - Is the ride covered by ASPC?
//  * 3. to_airport (boolean) - Is it going TO airport or FROM airport?
//  *
//  * Variants:
//  * - Connect Shuttles TO airport (uber_type=Connect, to_airport=true) - ONLY this combo
//  * - Subsidized TO airport (is_subsidized=true, to_airport=true, not Connect)
//  * - Subsidized FROM airport (is_subsidized=true, to_airport=false)
//  * - Unsubsidized (is_subsidized=false)
//  */

// function generateEmailHtml(
//   isSubsidized: boolean,
//   toAirport: boolean,
//   isConnect: boolean,
//   firstName: string,
//   rideDate: string,
//   rideTime: string,
//   airport: string,
//   voucher: string | null,
//   contingencyVoucher: string | null
// ): string {

//   // Variant 0: Connect Shuttles TO airport (ONLY to_airport=true + uber_type=Connect)
//   if (isConnect && toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Your ride will be served by a Connect Shuttles partner vehicle.</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above. The shuttle will depart promptly at the listed time.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Boarding Instructions</h4>
//           <p>This ride will be served by Connect Shuttles' local partners.</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>A shuttle vehicle will arrive at the pickup location at least 10 minutes before departure.</li>
//             <li>No voucher or ride request is required.</li>
//             <li>Simply meet your group, provide your name to the driver, and board the shuttle when it arrives.</li>
//             <li>To keep the schedule on time, the shuttle will depart promptly at the listed time.</li>
//           </ul>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li><strong>Student-initiated cancellations</strong> after the matching deadline may incur a cancellation fee.</li>
//             <li>To avoid a no-show fee, you must notify RideLink or submit the cancellation form at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 1: Subsidized TO Airport (voucher-based, not Connect)
//   if (isSubsidized && toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group. Add stops if your group needs to go to multiple terminals.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li>If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></li>
//             <li>To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 2: Subsidized FROM Airport (return trip)
//   if (isSubsidized && !toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <h4 style="margin-top: 12px;">Meeting Point:</h4>
//         <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
//         <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Voucher — Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//           <p style="margin-top: 12px; font-size: 14px;"><strong>Reminder:</strong> If a rider is missing at ride time, mark them as missing in the checklist so the rest of the group can still access the voucher.</p>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Delays & Contingency Vouchers</h4>
//           <p>Airline-initiated delays or cancellations are always covered.</p>
//           <p><strong>If your flight is delayed:</strong></p>
//           <ul style="margin: 8px 0 0; padding-left: 20px;">
//             <li>Complete the Delay Form at <a href="https://p-ickup.com/aspc-delay" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-delay</a> as soon as possible</li>
//             <li>PICKUP will automatically: confirm regrouping and provide new group information, or issue a contingency voucher</li>
//           </ul>
//           <p style="margin-top: 12px;">Contingency vouchers and regrouping is only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
//           <p style="margin-top: 12px;">If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>. To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</p>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 3: Unsubsidized
//   return `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//       <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//       <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>
//       <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3 style="margin-top: 0; color: #333;">
//           <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//         </h3>
//         <ul style="list-style: none; padding: 0;">
//           <li><strong>Date:</strong> ${rideDate}</li>
//           <li><strong>Time:</strong> ${rideTime}</li>
//           <li><strong>Airport:</strong> ${airport}</li>
//         </ul>
//       </div>
//       ${GROUP_BOX_HTML}
//       <p>We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.</p>
//       <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>
//       <p>If you have any questions about ASPC's Airport Rideshare program, please contact <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or view ASPC info page at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.</p>
//       <p>Safe travels,<br>The P-ICKUP Team<br></p>
//     </div>
//   `;
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }

//   try {
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
//     );

//     const { dry_run, ride_ids, date_start, date_end } = await req.json().catch(() => ({}));

//     // Fetch all verified matches that haven't been emailed yet
//     // No source filter - includes all verified matches
//     // is_subsidized derived from voucher/uber_type, not from DB
//     let query = supabase
//       .from('Matches')
//       .select(`
//         user_id,
//         ride_id,
//         flight_id,
//         voucher,
//         contingency_voucher,
//         uber_type,
//         date,
//         time,
//         is_verified,
//         email_sent,
//         Users(firstname, lastname, email, phonenumber),
//         Flights(date, airport, earliest_time, latest_time, to_airport)
//       `)
//       .eq('is_verified', true)
//       .or('email_sent.is.null,email_sent.eq.false');

//     if (ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0) {
//       query = query.in('ride_id', ride_ids);
//     }
//     if (date_start) {
//       query = query.gte('date', date_start);
//     }
//     if (date_end) {
//       query = query.lte('date', date_end);
//     }

//     const { data: allMatches, error: matchesError } = await query;

//     if (matchesError) {
//       throw new Error(`Failed to fetch matches: ${matchesError.message}`);
//     }

//     if (!allMatches || allMatches.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No verified matches found that need emails sent',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     console.log(`Processing ${allMatches.length} verified matches for email sending...`);

//     // Group matches by ride_id for efficient processing
//     const matchesByRide = new Map<number, typeof allMatches>();
//     for (const match of allMatches) {
//       const rideId = match.ride_id;
//       if (!matchesByRide.has(rideId)) {
//         matchesByRide.set(rideId, []);
//       }
//       matchesByRide.get(rideId)!.push(match);
//     }

//     // Prepare all emails
//     const emailBatch: any[] = [];
//     const matchMetadata: Array<{ user_id: string; ride_id: number }> = [];

//     for (const [rideId, rideMatches] of matchesByRide.entries()) {
//       const firstMatch = rideMatches[0];
//       const flightData = getRelation(firstMatch.Flights);
//       const toAirport = flightData?.to_airport ?? false;

//       for (const match of rideMatches) {
//         const user = getRelation(match.Users);
//         if (!user?.email) {
//           console.warn(`Skipping match - no email for user ${match.user_id}`);
//           continue;
//         }

//         const rideDate = match.date ?? flightData?.date ?? '';
//         const rideTime = match.time ? toAmPm(match.time) : "";
//         const airport = flightData?.airport ?? '';
//         const isSubsidized = deriveIsSubsidized(match);
//         const isConnect = match.uber_type?.toLowerCase() === 'connect';

//         const subject = isSubsidized
//           ? 'PICKUP — Your ASPC-subsidized ride group!'
//           : 'PICKUP — Your ride group!';

//         const emailHtml = generateEmailHtml(
//           isSubsidized,
//           toAirport,
//           isConnect,
//           user.firstname || 'there',
//           rideDate,
//           rideTime,
//           airport,
//           match.voucher,
//           match.contingency_voucher
//         );

//         emailBatch.push({
//           from: 'PICKUP <match@notify.p-ickup.com>',
//           to: [user.email],
//           cc: ['ridelink@aspc.pomona.edu'],
//           subject: subject,
//           html: emailHtml,
//           reply_to: [
//             'pickup.pai.47@gmail.com',
//             'ridelink@aspc.pomona.edu'
//           ]
//         });

//         matchMetadata.push({
//           user_id: match.user_id,
//           ride_id: match.ride_id
//         });
//       }
//     }

//     if (emailBatch.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No emails to send (missing email addresses)',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     if (dry_run) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'Dry run - no emails sent',
//         would_send: emailBatch.length,
//         preview: emailBatch.slice(0, 3).map(e => ({
//           to: e.to,
//           subject: e.subject
//         }))
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     // Send emails in batches of 100
//     const successfulMatches: Array<{ user_id: string; ride_id: number }> = [];
//     const failedMatches: Array<{ user_id: string; ride_id: number }> = [];
//     let totalSent = 0;

//     for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
//       const batch = emailBatch.slice(i, i + BATCH_SIZE);
//       const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE);

//       try {
//         const emailResponse = await fetch('https://api.resend.com/emails/batch', {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(batch)
//         });

//         if (!emailResponse.ok) {
//           const errorText = await emailResponse.text();
//           console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorText);

//           for (const meta of batchMetadata) {
//             failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//           }
//           continue;
//         }

//         const batchResult = await emailResponse.json();
//         const sentIds = batchResult.data || [];

//         if (sentIds.length === batch.length) {
//           for (const meta of batchMetadata) {
//             successfulMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//             totalSent++;
//           }
//           console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Sent ${sentIds.length} emails`);
//         } else {
//           for (let j = 0; j < sentIds.length; j++) {
//             successfulMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//             totalSent++;
//           }
//           for (let j = sentIds.length; j < batchMetadata.length; j++) {
//             failedMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//           }
//           console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Partial success - ${sentIds.length}/${batch.length} emails sent`);
//         }
//       } catch (error) {
//         console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
//         for (const meta of batchMetadata) {
//           failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//         }
//       }
//     }

//     // Mark emails as sent for successful sends
//     let updatedCount = 0;
//     let errorCount = 0;

//     if (successfulMatches.length > 0) {
//       console.log(`Attempting to update ${successfulMatches.length} matches as email_sent = true`);

//       for (const match of successfulMatches) {
//         const { data, error: updateError } = await supabase
//           .from('Matches')
//           .update({ email_sent: true })
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .select();

//         if (updateError) {
//           errorCount++;
//           console.error(`Failed to update email_sent for user ${match.user_id}, ride ${match.ride_id}:`, {
//             error: updateError.message,
//             code: updateError.code,
//             details: updateError.details
//           });
//         } else if (data && data.length > 0) {
//           updatedCount++;
//         } else {
//           errorCount++;
//           console.warn(`No rows updated for user ${match.user_id}, ride ${match.ride_id} - check if row exists with matching criteria`);
//         }
//       }

//       if (updatedCount > 0) {
//         console.log(`✅ Successfully marked ${updatedCount} matches as email_sent = true`);
//       }

//       if (errorCount > 0) {
//         console.error(`❌ Failed to update ${errorCount} matches - check logs above`);
//       }

//       if (updatedCount === 0 && errorCount === 0) {
//         console.warn(`⚠️ No matches were updated - possible issues:
//           - email_sent column may not exist (run migration)
//           - Matches may already have email_sent = true
//           - Row may not match criteria (user_id, ride_id)`);
//       }

//     } else {
//       console.warn('No successful matches to update - no emails were sent successfully');
//     }

//     // Verify updates were successful - check a sample
//     let verifiedCount = 0;
//     if (successfulMatches.length > 0) {
//       const sampleSize = Math.min(5, successfulMatches.length);
//       for (let i = 0; i < sampleSize; i++) {
//         const match = successfulMatches[i];
//         const { data } = await supabase
//           .from('Matches')
//           .select('email_sent')
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .single();

//         if (data?.email_sent === true) {
//           verifiedCount++;
//         }
//       }
//     }

//     return new Response(JSON.stringify({
//       success: true,
//       message: 'Batch email sending complete',
//       sent: totalSent,
//       failed: failedMatches.length,
//       total: emailBatch.length,
//       successful_matches_count: successfulMatches.length,
//       database_updated_count: updatedCount,
//       verified_sample: verifiedCount,
//       successful_matches: successfulMatches,
//       failed_matches: failedMatches
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//     });

//   } catch (error) {
//     console.error('Error in send-all-match-emails-batch:', error);
//     return new Response(JSON.stringify({
//       error: error.message,
//       stack: error.stack
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
//       status: 500
//     });
//   }
// });
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// // sends emails to people who is_verified = TRUE and email_sent = FALSE

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
// };

// const TURQ = "#06b6d4";
// const BATCH_SIZE = 100; // Resend batch limit

// /**
//  * Derive is_subsidized from voucher/uber_type instead of database.
//  * Subsidized = has voucher OR uber_type is Connect
//  */
// function deriveIsSubsidized(match: { voucher?: string | null; uber_type?: string | null }): boolean {
//   return Boolean(match.voucher?.trim()) || match.uber_type?.toLowerCase() === 'connect';
// }

// function toAmPm(timeStr: string | null | undefined): string {
//   if (!timeStr) return "";
//   const [hourStr, minuteStr] = timeStr.split(":");
//   let hour = parseInt(hourStr, 10);
//   const minute = minuteStr.padStart(2, "0");
//   const ampm = hour >= 12 ? "PM" : "AM";
//   hour = hour % 12 || 12;
//   return `${hour}:${minute} ${ampm}`;
// }

// /** Safely extract nested relation - Supabase may return object or array */
// function getRelation<T>(data: T | T[] | null | undefined): T | null {
//   if (!data) return null;
//   return Array.isArray(data) ? data[0] ?? null : data;
// }

// // COMMENTED OUT: Group display not working - using simple "view at p-ickup.com/results" box instead
// // function renderGroupList(members: any[], excludeUserId: string): string {
// //   if (!members || members.length === 0) return '<li>No other group members found.</li>';
// //
// //   const filteredMembers = members.filter(m => m.user_id !== excludeUserId);
// //
// //   return filteredMembers.map((member) => {
// //     const memberUser = getRelation(member.Users ?? member.users);
// //     const email = memberUser?.email || '';
// //     const phone = memberUser?.phonenumber || '';
// //     const contact = [email, phone].filter(Boolean).join(' · ');
// //
// //     return `
// //       <li style="margin-bottom: 10px;">
// //         <strong>${memberUser?.firstname || ''} ${memberUser?.lastname || ''}</strong><br>
// //         <small>${contact}</small>
// //       </li>
// //     `;
// //   }).join('');
// // }

// const GROUP_BOX_HTML = `
//   <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//     <h3 style="margin-top: 0; color: #06b6d4;">Your Group</h3>
//     <p style="margin: 0;">View your group at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>.</p>
//   </div>
// `;

// /**
//  * EMAIL LOGIC:
//  *
//  * There are 4 email variants based on:
//  * 1. uber_type = Connect - Connect Shuttles (shuttle, no voucher)
//  * 2. is_subsidized (derived: has voucher OR uber_type=Connect) - Is the ride covered by ASPC?
//  * 3. to_airport (boolean) - Is it going TO airport or FROM airport?
//  *
//  * Variants:
//  * - Connect Shuttles TO airport (uber_type=Connect, to_airport=true) - ONLY this combo
//  * - Subsidized TO airport (is_subsidized=true, to_airport=true, not Connect)
//  * - Subsidized FROM airport (is_subsidized=true, to_airport=false)
//  * - Unsubsidized (is_subsidized=false)
//  */

// function generateEmailHtml(
//   isSubsidized: boolean,
//   toAirport: boolean,
//   isConnect: boolean,
//   firstName: string,
//   rideDate: string,
//   rideTime: string,
//   airport: string,
//   groupMembersHtml: string,
//   voucher: string | null,
//   contingencyVoucher: string | null
// ): string {

//   // Variant 0: Connect Shuttles TO airport (ONLY to_airport=true + uber_type=Connect)
//   if (isConnect && toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Your ride will be served by a Connect Shuttles partner vehicle.</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above. The shuttle will depart promptly at the listed time.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Boarding Instructions</h4>
//           <p>This ride will be served by Connect Shuttles' local partners.</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>A shuttle vehicle will arrive at the pickup location at least 10 minutes before departure.</li>
//             <li>No voucher or ride request is required.</li>
//             <li>Simply meet your group, provide your name to the driver, and board the shuttle when it arrives.</li>
//             <li>To keep the schedule on time, the shuttle will depart promptly at the listed time.</li>
//           </ul>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li><strong>Student-initiated cancellations</strong> after the matching deadline may incur a cancellation fee.</li>
//             <li>To avoid a no-show fee, you must notify RideLink or submit the cancellation form at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 1: Subsidized TO Airport (voucher-based, not Connect)
//   if (isSubsidized && toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group. Add stops if your group needs to go to multiple terminals.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li>If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></li>
//             <li>To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 2: Subsidized FROM Airport (return trip)
//   if (isSubsidized && !toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <h4 style="margin-top: 12px;">Meeting Point:</h4>
//         <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
//         <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
//         ${GROUP_BOX_HTML}
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Voucher — Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//           <p style="margin-top: 12px; font-size: 14px;"><strong>Reminder:</strong> If a rider is missing at ride time, mark them as missing in the checklist so the rest of the group can still access the voucher.</p>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Delays & Contingency Vouchers</h4>
//           <p>Airline-initiated delays or cancellations are always covered.</p>
//           <p><strong>If your flight is delayed:</strong></p>
//           <ul style="margin: 8px 0 0; padding-left: 20px;">
//             <li>Complete the Delay Form at <a href="https://p-ickup.com/aspc-delay" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-delay</a> as soon as possible</li>
//             <li>PICKUP will automatically: confirm regrouping and provide new group information, or issue a contingency voucher</li>
//           </ul>
//           <p style="margin-top: 12px;">Contingency vouchers and regrouping is only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
//           <p style="margin-top: 12px;">If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>. To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</p>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 3: Unsubsidized
//   return `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//       <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//       <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>
//       <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3 style="margin-top: 0; color: #333;">
//           <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//         </h3>
//         <ul style="list-style: none; padding: 0;">
//           <li><strong>Date:</strong> ${rideDate}</li>
//           <li><strong>Time:</strong> ${rideTime}</li>
//           <li><strong>Airport:</strong> ${airport}</li>
//         </ul>
//       </div>
//       ${GROUP_BOX_HTML}
//       <p>We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.</p>
//       <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>
//       <p>If you have any questions about ASPC's Airport Rideshare program, please contact <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or view ASPC info page at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.</p>
//       <p>Safe travels,<br>The P-ICKUP Team<br></p>
//     </div>
//   `;
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }

//   try {
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
//     );

//     const { dry_run, ride_ids, date_start, date_end } = await req.json().catch(() => ({}));

//     // Fetch all verified matches that haven't been emailed yet
//     // No source filter - includes all verified matches
//     // is_subsidized derived from voucher/uber_type, not from DB
//     let query = supabase
//       .from('Matches')
//       .select(`
//         user_id,
//         ride_id,
//         flight_id,
//         voucher,
//         contingency_voucher,
//         uber_type,
//         date,
//         time,
//         is_verified,
//         email_sent,
//         Users(firstname, lastname, email, phonenumber),
//         Flights(date, airport, earliest_time, latest_time, to_airport)
//       `)
//       .eq('is_verified', true)
//       .or('email_sent.is.null,email_sent.eq.false');

//     if (ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0) {
//       query = query.in('ride_id', ride_ids);
//     }
//     if (date_start) {
//       query = query.gte('date', date_start);
//     }
//     if (date_end) {
//       query = query.lte('date', date_end);
//     }

//     const { data: allMatches, error: matchesError } = await query;

//     if (matchesError) {
//       throw new Error(`Failed to fetch matches: ${matchesError.message}`);
//     }

//     if (!allMatches || allMatches.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No verified matches found that need emails sent',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     console.log(`Processing ${allMatches.length} verified matches for email sending...`);

//     // Group matches by ride_id for efficient processing
//     const matchesByRide = new Map<number, typeof allMatches>();
//     for (const match of allMatches) {
//       const rideId = match.ride_id;
//       if (!matchesByRide.has(rideId)) {
//         matchesByRide.set(rideId, []);
//       }
//       matchesByRide.get(rideId)!.push(match);
//     }

//     // Prepare all emails
//     const emailBatch: any[] = [];
//     const matchMetadata: Array<{ user_id: string; ride_id: number }> = [];

//     for (const [rideId, rideMatches] of matchesByRide.entries()) {
//       const firstMatch = rideMatches[0];
//       const flightData = getRelation(firstMatch.Flights);
//       const toAirport = flightData?.to_airport ?? false;

//       for (const match of rideMatches) {
//         const user = getRelation(match.Users);
//         if (!user?.email) {
//           console.warn(`Skipping match - no email for user ${match.user_id}`);
//           continue;
//         }

//         const rideDate = match.date ?? flightData?.date ?? '';
//         const rideTime = match.time ? toAmPm(match.time) : "";
//         const airport = flightData?.airport ?? '';
//         const isSubsidized = deriveIsSubsidized(match);
//         const isConnect = match.uber_type?.toLowerCase() === 'connect';

//         // COMMENTED OUT: Group display not working
//         // const groupMembers = rideMatches.filter(m => m.user_id !== match.user_id);
//         // const groupMembersHtml = renderGroupList(groupMembers, match.user_id);

//         const subject = isSubsidized
//           ? 'PICKUP — Your ASPC-subsidized ride group!'
//           : 'PICKUP — Your ride group!';

//         const emailHtml = generateEmailHtml(
//           isSubsidized,
//           toAirport,
//           isConnect,
//           user.firstname || 'there',
//           rideDate,
//           rideTime,
//           airport,
//           '', // groupMembersHtml - commented out, using GROUP_BOX_HTML instead
//           match.voucher,
//           match.contingency_voucher
//         );

//         emailBatch.push({
//           from: 'PICKUP <match@notify.p-ickup.com>',
//           to: [user.email],
//           cc: ['ridelink@aspc.pomona.edu'],
//           subject: subject,
//           html: emailHtml,
//           reply_to: [
//             'pickup.pai.47@gmail.com',
//             'ridelink@aspc.pomona.edu'
//           ]
//         });

//         matchMetadata.push({
//           user_id: match.user_id,
//           ride_id: match.ride_id
//         });
//       }
//     }

//     if (emailBatch.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No emails to send (missing email addresses)',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     if (dry_run) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'Dry run - no emails sent',
//         would_send: emailBatch.length,
//         preview: emailBatch.slice(0, 3).map(e => ({
//           to: e.to,
//           subject: e.subject
//         }))
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     // Send emails in batches of 100
//     const successfulMatches: Array<{ user_id: string; ride_id: number }> = [];
//     const failedMatches: Array<{ user_id: string; ride_id: number }> = [];
//     let totalSent = 0;

//     for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
//       const batch = emailBatch.slice(i, i + BATCH_SIZE);
//       const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE);

//       try {
//         const emailResponse = await fetch('https://api.resend.com/emails/batch', {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(batch)
//         });

//         if (!emailResponse.ok) {
//           const errorText = await emailResponse.text();
//           console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorText);

//           for (const meta of batchMetadata) {
//             failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//           }
//           continue;
//         }

//         const batchResult = await emailResponse.json();
//         const sentIds = batchResult.data || [];

//         if (sentIds.length === batch.length) {
//           for (const meta of batchMetadata) {
//             successfulMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//             totalSent++;
//           }
//           console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Sent ${sentIds.length} emails`);
//         } else {
//           for (let j = 0; j < sentIds.length; j++) {
//             successfulMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//             totalSent++;
//           }
//           for (let j = sentIds.length; j < batchMetadata.length; j++) {
//             failedMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//           }
//           console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Partial success - ${sentIds.length}/${batch.length} emails sent`);
//         }
//       } catch (error) {
//         console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
//         for (const meta of batchMetadata) {
//           failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//         }
//       }
//     }

//     // Mark emails as sent for successful sends
//     let updatedCount = 0;
//     let errorCount = 0;

//     if (successfulMatches.length > 0) {
//       console.log(`Attempting to update ${successfulMatches.length} matches as email_sent = true`);

//       for (const match of successfulMatches) {
//         const { data, error: updateError } = await supabase
//           .from('Matches')
//           .update({ email_sent: true })
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .select();

//         if (updateError) {
//           errorCount++;
//           console.error(`Failed to update email_sent for user ${match.user_id}, ride ${match.ride_id}:`, {
//             error: updateError.message,
//             code: updateError.code,
//             details: updateError.details
//           });
//         } else if (data && data.length > 0) {
//           updatedCount++;
//         } else {
//           errorCount++;
//           console.warn(`No rows updated for user ${match.user_id}, ride ${match.ride_id} - check if row exists with matching criteria`);
//         }
//       }

//       if (updatedCount > 0) {
//         console.log(`✅ Successfully marked ${updatedCount} matches as email_sent = true`);
//       }

//       if (errorCount > 0) {
//         console.error(`❌ Failed to update ${errorCount} matches - check logs above`);
//       }

//       if (updatedCount === 0 && errorCount === 0) {
//         console.warn(`⚠️ No matches were updated - possible issues:
//           - email_sent column may not exist (run migration)
//           - Matches may already have email_sent = true
//           - Row may not match criteria (user_id, ride_id)`);
//       }

//     } else {
//       console.warn('No successful matches to update - no emails were sent successfully');
//     }

//     // Verify updates were successful - check a sample
//     let verifiedCount = 0;
//     if (successfulMatches.length > 0) {
//       const sampleSize = Math.min(5, successfulMatches.length);
//       for (let i = 0; i < sampleSize; i++) {
//         const match = successfulMatches[i];
//         const { data } = await supabase
//           .from('Matches')
//           .select('email_sent')
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .single();

//         if (data?.email_sent === true) {
//           verifiedCount++;
//         }
//       }
//     }

//     return new Response(JSON.stringify({
//       success: true,
//       message: 'Batch email sending complete',
//       sent: totalSent,
//       failed: failedMatches.length,
//       total: emailBatch.length,
//       successful_matches_count: successfulMatches.length,
//       database_updated_count: updatedCount,
//       verified_sample: verifiedCount,
//       successful_matches: successfulMatches,
//       failed_matches: failedMatches
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//     });

//   } catch (error) {
//     console.error('Error in send-all-match-emails-batch:', error);
//     return new Response(JSON.stringify({
//       error: error.message,
//       stack: error.stack
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
//       status: 500
//     });
//   }
// });

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// // sends emails to people who is_verified = TRUE and email_sent = FALSE
// // (includes source = ml, manual, manual_add - any verified match)

// async function delay(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

// // In your batch sending loop
// const DELAY_BETWEEN_BATCHES = 500 // 500ms = 2 req/sec

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
// };

// const TURQ = "#06b6d4";
// const BATCH_SIZE = 100; // Resend batch limit

// /**
//  * Derive is_subsidized from voucher/uber_type instead of database.
//  * Subsidized = has voucher OR uber_type is Connect
//  */
// function deriveIsSubsidized(match: { voucher?: string | null; uber_type?: string | null }): boolean {
//   return Boolean(match.voucher?.trim()) || match.uber_type?.toLowerCase() === 'connect';
// }

// function toAmPm(timeStr: string | null | undefined): string {
//   if (!timeStr) return "";
//   const [hourStr, minuteStr] = timeStr.split(":");
//   let hour = parseInt(hourStr, 10);
//   const minute = minuteStr.padStart(2, "0");
//   const ampm = hour >= 12 ? "PM" : "AM";
//   hour = hour % 12 || 12;
//   return `${hour}:${minute} ${ampm}`;
// }

// function renderGroupList(members: any[], excludeUserId: string): string {
//   if (!members || members.length === 0) return '<li>No other group members found.</li>';

//   const filteredMembers = members.filter(m => m.user_id !== excludeUserId);

//   return filteredMembers.map((member) => {
//     const email = member.Users?.email || '';
//     const phone = member.Users?.phonenumber || '';
//     const contact = [email, phone].filter(Boolean).join(' · ');

//     return `
//       <li style="margin-bottom: 10px;">
//         <strong>${member.Users?.firstname || ''} ${member.Users?.lastname || ''}</strong><br>
//         <small>${contact}</small>
//       </li>
//     `;
//   }).join('');
// }

// /**
//  * EMAIL LOGIC:
//  *
//  * There are 4 email variants based on:
//  * 1. uber_type = Connect → Connect Shuttles variant
//  * 2. is_subsidized (derived: has voucher OR uber_type=Connect) - Is the ride covered by ASPC?
//  * 3. to_airport (boolean) - Is it going TO airport or FROM airport?
//  *
//  * Variants:
//  * - Connect Shuttles (uber_type=connect) - shuttle, no voucher; TO and FROM supported
//  * - Subsidized TO airport (is_subsidized=true, to_airport=true, not Connect)
//  * - Subsidized FROM airport (is_subsidized=true, to_airport=false)
//  * - Unsubsidized (is_subsidized=false)
//  *
//  * Additionally:
//  * - Contingency voucher shown only for FROM airport trips (to_airport=false)
//  * - Different meeting point instructions for TO vs FROM
//  */

// function generateEmailHtml(
//   isSubsidized: boolean,
//   toAirport: boolean,
//   isConnect: boolean,
//   firstName: string,
//   rideDate: string,
//   rideTime: string,
//   airport: string,
//   groupMembersHtml: string,
//   voucher: string | null,
//   contingencyVoucher: string | null
// ): string {

//   // Variant 0: Connect Shuttles
//   if (isConnect) {
//     const meetingPointBlock = toAirport
//       ? `<p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above. The shuttle will depart promptly at the listed time.</p>`
//       : `
//         <h4 style="margin-top: 12px;">Meeting Point:</h4>
//         <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
//         <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
//         <p>The shuttle will depart promptly at the listed time.</p>
//       `;

//     const policyBlock = toAirport
//       ? `
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li><strong>Student-initiated cancellations</strong> after the matching deadline may incur a cancellation fee.</li>
//             <li>To avoid a no-show fee, you must notify RideLink or submit the cancellation form at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//       `
//       : `
//         <div style="background:#fff3cd;padding:16px;border-radius:8px;margin-top:20px;">
//           <p><strong>Important:</strong> While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</p>
//         </div>
//       `;

//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Your ride will be served by a Connect Shuttles partner vehicle.</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         ${meetingPointBlock}
//         <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
//           <p>This ride will be served by a high-capacity vehicle (van, mini-bus, or coach) operated by a Connect Shuttles partner. You can check the latest group information at: <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>.</p>
//           <p style="margin-top: 12px; font-size: 14px; color: #6b7280;"><em>Note: Connect Shuttles may sell additional seats to other 5C students. These riders will not appear in your PICKUP group listing.</em></p>
//         </div>
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Boarding Instructions</h4>
//           <p>This ride will be served by Connect Shuttles' local partners.</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>A shuttle vehicle will arrive at the pickup location at least 10 minutes before departure.</li>
//             <li>No voucher or ride request is required.</li>
//             <li>Simply meet your group, provide your name to the driver, and board the shuttle when it arrives.</li>
//             <li>To keep the schedule on time, the shuttle will depart promptly at the listed time.</li>
//           </ul>
//         </div>
//         ${policyBlock}
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 1: Subsidized TO Airport (voucher-based, not Connect)
//   if (isSubsidized && toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>
//         <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
//           <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//           <p style="margin-top: 12px; font-size: 14px; color: #6b7280;">Group assignments may change. Always check your latest group information at: <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>.</p>
//         </div>
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group. Add stops if your group needs to go to multiple terminals.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Changes (Outbound Policy)</h4>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li><strong>Airline-initiated flight changes:</strong> You may cancel without penalty.</li>
//             <li>If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a></li>
//             <li>To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</li>
//           </ul>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 2: Subsidized FROM Airport (return trip, inbound to campus)
//   if (isSubsidized && !toAirport) {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming airport rideshare trip, covered by ASPC RideLink!</p>
//         <p>Please review your ride details below:</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <h4 style="margin-top: 12px;">Meeting Point:</h4>
//         <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
//         <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
//         <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
//           <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//           <p style="margin-top: 12px; font-size: 14px; color: #6b7280;">⚠️ Group assignments may change. Always check your latest group information at: <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>.</p>
//         </div>
//         <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${TURQ};">
//           <h4 style="margin-top: 0; color: #0c4a6e;">Voucher — Accessing your voucher</h4>
//           <p>When your group meets and is ready to leave:</p>
//           <ul style="margin: 12px 0 0; padding-left: 20px;">
//             <li>Each rider must complete the Ride Ready checklist at <a href="https://p-ickup.com/aspc-ready" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-ready</a></li>
//             <li>Once all riders are marked ready (or missing), the Uber voucher link will appear.</li>
//             <li>One rider clicks the voucher link, adds it to their Uber account, and requests the ride for the group.</li>
//             <li>The ride will be automatically billed to ASPC through the voucher.</li>
//           </ul>
//           <p style="margin-top: 12px; font-size: 14px;"><strong>Reminder:</strong> If a rider is missing at ride time, mark them as missing in the checklist so the rest of the group can still access the voucher.</p>
//         </div>
//         <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//           <h4 style="margin-top: 0;">Flight Delays & Contingency Vouchers</h4>
//           <p>Airline-initiated delays or cancellations are always covered.</p>
//           <p><strong>If your flight is delayed:</strong></p>
//           <ul style="margin: 8px 0 0; padding-left: 20px;">
//             <li>Complete the Delay Form at <a href="https://p-ickup.com/aspc-delay" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/aspc-delay</a> as soon as possible</li>
//             <li>PICKUP will automatically: confirm regrouping and provide new group information, or issue a contingency voucher</li>
//           </ul>
//           <p style="margin-top: 12px;">Contingency vouchers and regrouping is only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
//           <p style="margin-top: 12px;">If you'd like to cancel your match for voluntary reasons, cancellation fees may apply. You can cancel your ride at <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a>. To avoid a no-show fee, you must notify RideLink or cancel at least 1 hour before your scheduled ride.</p>
//         </div>
//         <p style="margin-top: 20px; color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info" style="color: #0ea5e9; text-decoration: none;">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295" style="color: #0ea5e9; text-decoration: none;">(909) 347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 3: Unsubsidized
//   return `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//       <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//       <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>
//       <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3 style="margin-top: 0; color: #333;">
//           <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//         </h3>
//         <ul style="list-style: none; padding: 0;">
//           <li><strong>Date:</strong> ${rideDate}</li>
//           <li><strong>Time:</strong> ${rideTime}</li>
//           <li><strong>Airport:</strong> ${airport}</li>
//         </ul>
//       </div>
//       <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3>Your Group</h3>
//         <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//       </div>
//       <p>We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.</p>
//       <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>
//       <p>If you have any questions about ASPC's Airport Rideshare program, please contact <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or view ASPC info page at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.</p>
//       <p>Safe travels,<br>The P-ICKUP Team<br></p>
//     </div>
//   `;
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }

//   try {
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
//     );

//     const { dry_run, ride_ids, date_start, date_end } = await req.json().catch(() => ({}));

//     // Fetch all verified matches that haven't been emailed yet
//     // Note: is_subsidized is NOT used - we derive it from voucher/uber_type
//     let query = supabase
//       .from('Matches')
//       .select(`
//         user_id,
//         ride_id,
//         flight_id,
//         voucher,
//         contingency_voucher,
//         uber_type,
//         date,
//         time,
//         source,
//         is_verified,
//         email_sent,
//         Users(firstname, lastname, email, phonenumber),
//         Flights(date, airport, earliest_time, latest_time, to_airport)
//       `)
//       .eq('is_verified', true)
//       .or('email_sent.is.null,email_sent.eq.false');

//     if (ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0) {
//       query = query.in('ride_id', ride_ids);
//     }
//     if (date_start) {
//       query = query.gte('date', date_start);
//     }
//     if (date_end) {
//       query = query.lte('date', date_end);
//     }

//     const { data: allMatches, error: matchesError } = await query;

//     if (matchesError) {
//       throw new Error(`Failed to fetch matches: ${matchesError.message}`);
//     }

//     if (!allMatches || allMatches.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No verified matches found that need emails sent',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     console.log(`Processing ${allMatches.length} verified matches for email sending...`);

//     // Group matches by ride_id for efficient processing
//     const matchesByRide = new Map<number, typeof allMatches>();
//     for (const match of allMatches) {
//       const rideId = match.ride_id;
//       if (!matchesByRide.has(rideId)) {
//         matchesByRide.set(rideId, []);
//       }
//       matchesByRide.get(rideId)!.push(match);
//     }

//     // Prepare all emails
//     const emailBatch: any[] = [];
//     const matchMetadata: Array<{ user_id: string; ride_id: number }> = [];

//     for (const [rideId, rideMatches] of matchesByRide.entries()) {
//       const firstMatch = rideMatches[0];
//       const flightData = firstMatch.Flights;
//       const toAirport = flightData?.to_airport ?? false;

//       for (const match of rideMatches) {
//         const user = match.Users;
//         if (!user?.email) {
//           console.warn(`Skipping match - no email for user ${match.user_id}`);
//           continue;
//         }

//         const rideDate = match.date ?? flightData?.date ?? '';
//         const rideTime = match.time ? toAmPm(match.time) : "";
//         const airport = flightData?.airport ?? '';
//         const isSubsidized = deriveIsSubsidized(match);
//         const isConnect = match.uber_type?.toLowerCase() === 'connect';

//         const groupMembers = rideMatches.filter(m => m.user_id !== match.user_id);
//         const groupMembersHtml = renderGroupList(groupMembers, match.user_id);

//         const subject = isSubsidized
//           ? 'PICKUP — Your ASPC-subsidized ride group!'
//           : 'PICKUP — Your ride group!';

//         const emailHtml = generateEmailHtml(
//           isSubsidized,
//           toAirport,
//           isConnect,
//           user.firstname || 'there',
//           rideDate,
//           rideTime,
//           airport,
//           groupMembersHtml,
//           match.voucher,
//           match.contingency_voucher
//         );

//         emailBatch.push({
//           from: 'PICKUP <match@notify.p-ickup.com>',
//           to: [user.email],
//           cc: ['ridelink@aspc.pomona.edu'],
//           subject: subject,
//           html: emailHtml,
//           reply_to: [
//             'pickup.pai.47@gmail.com',
//             'ridelink@aspc.pomona.edu'
//           ]
//         });

//         matchMetadata.push({
//           user_id: match.user_id,
//           ride_id: match.ride_id
//         });
//       }
//     }

//     if (emailBatch.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No emails to send (missing email addresses)',
//         sent: 0,
//         failed: 0,
//         total: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     if (dry_run) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'Dry run - no emails sent',
//         would_send: emailBatch.length,
//         preview: emailBatch.slice(0, 3).map(e => ({
//           to: e.to,
//           subject: e.subject
//         }))
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     // Send emails in batches of 100 with rate limiting
//     const successfulMatches: Array<{ user_id: string; ride_id: number }> = [];
//     const failedMatches: Array<{ user_id: string; ride_id: number }> = [];
//     let totalSent = 0;

//     for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
//       const batch = emailBatch.slice(i, i + BATCH_SIZE);
//       const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE);

//       try {
//         const emailResponse = await fetch('https://api.resend.com/emails/batch', {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(batch)
//         });

//         if (!emailResponse.ok) {
//           const errorText = await emailResponse.text();
//           console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorText);

//           for (const meta of batchMetadata) {
//             failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//           }
//           continue;
//         }

//         const batchResult = await emailResponse.json();
//         const sentIds = batchResult.data || [];

//         if (sentIds.length === batch.length) {
//           for (const meta of batchMetadata) {
//             successfulMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//             totalSent++;
//           }
//           console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Sent ${sentIds.length} emails`);
//         } else {
//           for (let j = 0; j < sentIds.length; j++) {
//             successfulMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//             totalSent++;
//           }
//           for (let j = sentIds.length; j < batchMetadata.length; j++) {
//             failedMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//           }
//           console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Partial success - ${sentIds.length}/${batch.length} emails sent`);
//         }
//       } catch (error) {
//         console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
//         for (const meta of batchMetadata) {
//           failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//         }
//       }

//       if (i + BATCH_SIZE < emailBatch.length) {
//         await delay(DELAY_BETWEEN_BATCHES)
//       }
//     }

//     // Mark emails as sent for successful sends
//     let updatedCount = 0;
//     let errorCount = 0;

//     if (successfulMatches.length > 0) {
//       console.log(`Attempting to update ${successfulMatches.length} matches as email_sent = true`);

//       for (const match of successfulMatches) {
//         const { data, error: updateError } = await supabase
//           .from('Matches')
//           .update({ email_sent: true })
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .select();

//         if (updateError) {
//           errorCount++;
//           console.error(`Failed to update email_sent for user ${match.user_id}, ride ${match.ride_id}:`, {
//             error: updateError.message,
//             code: updateError.code,
//             details: updateError.details
//           });
//         } else if (data && data.length > 0) {
//           updatedCount++;
//         } else {
//           errorCount++;
//           console.warn(`No rows updated for user ${match.user_id}, ride ${match.ride_id} - check if row exists with matching criteria`);
//         }
//       }

//       if (updatedCount > 0) {
//         console.log(`✅ Successfully marked ${updatedCount} matches as email_sent = true`);
//       }

//       if (errorCount > 0) {
//         console.error(`❌ Failed to update ${errorCount} matches - check logs above`);
//       }

//       if (updatedCount === 0 && errorCount === 0) {
//         console.warn(`⚠️ No matches were updated - possible issues:
//           - email_sent column may not exist (run migration)
//           - Matches may already have email_sent = true
//           - Row may not match criteria (user_id, ride_id)`);
//       }

//     } else {
//       console.warn('No successful matches to update - no emails were sent successfully');
//     }

//     // Verify updates were successful - check a sample
//     let verifiedCount = 0;
//     if (successfulMatches.length > 0) {
//       const sampleSize = Math.min(5, successfulMatches.length);
//       for (let i = 0; i < sampleSize; i++) {
//         const match = successfulMatches[i];
//         const { data } = await supabase
//           .from('Matches')
//           .select('email_sent')
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .single();

//         if (data?.email_sent === true) {
//           verifiedCount++;
//         }
//       }
//     }

//     return new Response(JSON.stringify({
//       success: true,
//       message: 'Batch email sending complete',
//       sent: totalSent,
//       failed: failedMatches.length,
//       total: emailBatch.length,
//       successful_matches_count: successfulMatches.length,
//       database_updated_count: updatedCount,
//       verified_sample: verifiedCount,
//       successful_matches: successfulMatches,
//       failed_matches: failedMatches
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//     });

//   } catch (error) {
//     console.error('Error in send-all-match-emails-batch:', error);
//     return new Response(JSON.stringify({
//       error: error.message,
//       stack: error.stack
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
//       status: 500
//     });
//   }
// });

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// // sends emails to people who is_verified = TRUE, source = ml, and email_sent = FALSE

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
// };

// const TURQ = "#06b6d4";
// const BATCH_SIZE = 100; // Resend batch limit

// function toAmPm(timeStr: string | null | undefined): string {
//   if (!timeStr) return "";
//   const [hourStr, minuteStr] = timeStr.split(":");
//   let hour = parseInt(hourStr, 10);
//   const minute = minuteStr.padStart(2, "0");
//   const ampm = hour >= 12 ? "PM" : "AM";
//   hour = hour % 12 || 12;
//   return `${hour}:${minute} ${ampm}`;
// }

// function renderGroupList(members: any[], excludeUserId: string): string {
//   if (!members || members.length === 0) return '<li>No other group members found.</li>';

//   const filteredMembers = members.filter(m => m.user_id !== excludeUserId);

//   return filteredMembers.map((member) => {
//     const email = member.Users?.email || '';
//     const phone = member.Users?.phonenumber || '';
//     const contact = [email, phone].filter(Boolean).join(' · ');

//     return `
//       <li style="margin-bottom: 10px;">
//         <strong>${member.Users?.firstname || ''} ${member.Users?.lastname || ''}</strong><br>
//         <small>${contact}</small>
//       </li>
//     `;
//   }).join('');
// }

// /**
//  * EMAIL LOGIC:
//  *
//  * There are 3 email variants based on:
//  * 1. is_subsidized (boolean) - Is the ride covered by ASPC?
//  * 2. to_airport (boolean) - Is it going TO airport or FROM airport?
//  *
//  * Variants:
//  * - Subsidized TO airport (is_subsidized=true, to_airport=true)
//  * - Subsidized FROM airport (is_subsidized=true, to_airport=false)
//  * - Unsubsidized (is_subsidized=false)
//  *
//  * Additionally:
//  * - Contingency voucher shown only for FROM airport trips (to_airport=false)
//  * - Different meeting point instructions for TO vs FROM
//  */

// function generateEmailHtml(
//   isSubsidized: boolean,
//   toAirport: boolean,
//   firstName: string,
//   rideDate: string,
//   rideTime: string,
//   airport: string,
//   groupMembersHtml: string,
//   voucher: string | null,
//   contingencyVoucher: string | null
// ): string {

//   // Variant 1: Subsidized TO Airport
//   if (isSubsidized && toAirport) {
//     // Contingency vouchers are only for return trips (FROM airport), not departures
//     // For TO airport trips, just show the standard message
//     const contingencyBlock = `
//       <div style="background:#fff3cd;padding:16px;border-radius:8px;margin-top:20px;">
//         <p><strong>Important:</strong> While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</p>
//       </div>
//     `;

//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>You've been successfully matched for your upcoming Airport Rideshare trip, covered by ASPC RideLink!</p>
//         <h3 style="margin-top:0;">Please review your group details and departure instructions below:</h3>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>
//         <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
//           <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//         </div>
//         <div style="background:#ffffff; padding: 16px; border-radius:8px; margin-top:10px;">
//           <h4 style="margin-top:0;">Voucher</h4>
//           <p><span style="background-color: yellow;">Please do not click on this link until your group is ready to request the ride.</span> Use this unique Uber Voucher link to book your group's ride: <strong><a href="${voucher}">${voucher}</a></strong></p>
//           <p>Only one group member needs to request the ride; the voucher will automatically apply to cover the fare. <strong>Tips are not covered</strong> and bill to card on file (set by Uber); group is responsible to split if desired.</p>
//           <p>If your group needs to stop at multiple terminals, <strong>add all stops before requesting the ride.</strong></p>
//           <p>If your group has <strong>4 or more people</strong> and/or more than <strong>4 suitcases</strong>, you <strong>may request an Uber XL or Uber XXL</strong> as needed.</p>
//         </div>
//         ${contingencyBlock}
//         <p style="color: #666; font-size: 12px;">For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a>.</p>
//         <p style="color:#666; font-size:14px;">Safe travels,<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 2: Subsidized FROM Airport (return trip)
//   if (isSubsidized && !toAirport) {
//     const contingencyBlock = contingencyVoucher ? `
//       <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
//         <h4 style="margin-top: 0;">Flight Delays & Contingency Vouchers</h4>
//         <p>If your flight is delayed or canceled by the airline:</p>
//         <ol>
//           <li>First contact RideLink: email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or call/text <a href="tel:9093475295">(909)347-5295</a> (phone support available from U.S./Canada only). Text your group members.</li>
//           <li>If regrouping is not possible OR if RideLink staff do not respond within 15 minutes of your arrival, you may use your contingency voucher (linked at the bottom of this email).</li>
//         </ol>
//         <p><strong>Important:</strong> You must submit the Delay Verification Form (found <a href="https://p-ickup.com/aspc-info">here</a>) within 24 hours of arrival. Failure to submit may result in being billed for the ride.</p>
//         <p>Contingency vouchers are only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
//         <p>Your contingency voucher code is: <strong><a href="${contingencyVoucher}">${contingencyVoucher}</a></strong></p>
//         <p><strong>While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</strong></p>
//       </div>
//     ` : `
//       <div style="background:#fff3cd;padding:16px;border-radius:8px;margin-top:20px;">
//         <p><strong>Important:</strong> While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</p>
//       </div>
//     `;

//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//         <p>Welcome back! You've been matched for your Airport Rideshare return trip to campus, subsidized by ASPC.</p>
//         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: #333;">
//             <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//           </h3>
//           <ul style="list-style: none; padding: 0;">
//             <li><strong>Date:</strong> ${rideDate}</li>
//             <li><strong>Time:</strong> ${rideTime}</li>
//             <li><strong>Airport:</strong> ${airport}</li>
//           </ul>
//         </div>
//         <h4 style="margin-top: 12px;">Meeting Point:</h4>
//         <p><strong>ONT (Ontario):</strong> Coordinate with your group to select one curbside pickup point. Use the inter-terminal shuttle if needed.</p>
//         <p><strong>LAX (Los Angeles):</strong> All pickups must happen from LAX-it. Take the LAX-it shuttle from the Arrivals (lower) level curbside (runs every ~5 minutes, ~15 min ride). Walking is possible from Terminals 1, 2, 7, or 8.</p>
//         <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//           <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
//           <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//         </div>
//         <div style="background:#ffffff; padding: 16px; border-radius:8px; margin-top:10px;">
//           <h4 style="margin-top:0;">Voucher</h4>
//           <p><span style="background-color: yellow;">Please do not click on this link until your group is ready to request the ride.</span> Use this unique Uber Voucher link to book your group's ride: <strong><a href="${voucher}">${voucher}</a></strong></p>
//           <p>Only one group member needs to request the ride; the voucher will automatically apply to cover the fare. <strong>Tips are not covered</strong> and bill to card on file (set by Uber); group is responsible to split if desired.</p>
//           <p>If your group needs to stop at multiple terminals, <strong>add all stops before requesting the ride.</strong></p>
//           <p>If your group has <strong>4 or more people</strong> and/or more than <strong>4 suitcases</strong>, you <strong>may request an Uber XL or Uber XXL</strong> as needed.</p>
//         </div>
//         ${contingencyBlock}
//         <p>If you have any questions about ASPC's Airport Rideshare program, please visit the policy guide at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295">(909)347-5295</a> for support.</p>
//         <p style="color:#666; font-size:14px;">We hope you had a safe trip, and welcome back to campus!<br>The PICKUP Team<br>In partnership with ASPC RideLink</p>
//       </div>
//     `;
//   }

//   // Variant 3: Unsubsidized
//   return `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//       <h2 style="color: ${TURQ};">Hello ${firstName || 'there'}!</h2>
//       <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>
//       <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3 style="margin-top: 0; color: #333;">
//           <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">Ride Details</a>
//         </h3>
//         <ul style="list-style: none; padding: 0;">
//           <li><strong>Date:</strong> ${rideDate}</li>
//           <li><strong>Time:</strong> ${rideTime}</li>
//           <li><strong>Airport:</strong> ${airport}</li>
//         </ul>
//       </div>
//       <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
//         <h3>Your Group</h3>
//         <ul style="list-style: none; padding: 0;">${groupMembersHtml}</ul>
//       </div>
//       <p>We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.</p>
//       <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>
//       <p>If you have any questions about ASPC's Airport Rideshare program, please contact <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or view ASPC info page at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.</p>
//       <p>Safe travels,<br>The P-ICKUP Team<br></p>
//     </div>
//   `;
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }

//   try {
//     // Use service role key for updates to bypass RLS if needed
//     // If RLS is blocking updates, you may need to use service_role key instead of anon_key
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
//     );

//     const { dry_run, ride_ids } = await req.json().catch(() => ({}));

//     // Fetch all verified matches that haven't been emailed yet
//     let query = supabase
//       .from('Matches')
//       .select(`
//         user_id,
//         ride_id,
//         flight_id,
//         is_subsidized,
//         voucher,
//         contingency_voucher,
//         date,
//         time,
//         source,
//         is_verified,
//         email_sent,
//         Users(firstname, lastname, email, phonenumber),
//         Flights(date, airport, earliest_time, latest_time, to_airport)
//       `)
//       // .eq('source', 'ml')
//       .eq('is_verified', true)
//       .or('email_sent.is.null,email_sent.eq.false');

//     if (ride_ids && Array.isArray(ride_ids) && ride_ids.length > 0) {
//       query = query.in('ride_id', ride_ids);
//     }

//     const { data: allMatches, error: matchesError } = await query;

//     if (matchesError) {
//       throw new Error(`Failed to fetch matches: ${matchesError.message}`);
//     }

//     if (!allMatches || allMatches.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No verified matches found that need emails sent',
//         sent: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     console.log(`Processing ${allMatches.length} verified matches for email sending...`);

//     // Group matches by ride_id for efficient processing
//     const matchesByRide = new Map<number, typeof allMatches>();
//     for (const match of allMatches) {
//       const rideId = match.ride_id;
//       if (!matchesByRide.has(rideId)) {
//         matchesByRide.set(rideId, []);
//       }
//       matchesByRide.get(rideId)!.push(match);
//     }

//     // Prepare all emails
//     const emailBatch: any[] = [];
//     const matchMetadata: Array<{ user_id: string; ride_id: number }> = [];

//     for (const [rideId, rideMatches] of matchesByRide.entries()) {
//       // Get flight data (all matches in a ride share the same flight characteristics)
//       const firstMatch = rideMatches[0];
//       const flightData = firstMatch.Flights;
//       const toAirport = flightData?.to_airport ?? false;

//       for (const match of rideMatches) {
//         const user = match.Users;
//         if (!user?.email) {
//           console.warn(`Skipping match - no email for user ${match.user_id}`);
//           continue;
//         }

//         const rideDate = match.date ?? flightData?.date ?? '';
//         const rideTime = match.time ? toAmPm(match.time) : "";
//         const airport = flightData?.airport ?? '';
//         const isSubsidized = match.is_subsidized ?? false;

//         // Get other group members (exclude current user)
//         const groupMembers = rideMatches.filter(m => m.user_id !== match.user_id);
//         const groupMembersHtml = renderGroupList(groupMembers, match.user_id);

//         // Determine email subject
//         const subject = isSubsidized
//           ? 'PICKUP — Your ASPC-subsidized ride group!'
//           : 'PICKUP — Your ride group!';

//         // Generate email HTML based on logic
//         const emailHtml = generateEmailHtml(
//           isSubsidized,
//           toAirport,
//           user.firstname || 'there',
//           rideDate,
//           rideTime,
//           airport,
//           groupMembersHtml,
//           match.voucher,
//           match.contingency_voucher
//         );

//         emailBatch.push({
//           from: 'PICKUP <match@notify.p-ickup.com>',
//           to: [user.email],
//           cc: ['ridelink@aspc.pomona.edu'],
//           subject: subject,
//           html: emailHtml,
//           reply_to: [
//             'pickup.pai.47@gmail.com',
//             'ridelink@aspc.pomona.edu'
//           ]
//         });

//         matchMetadata.push({
//           user_id: match.user_id,
//           ride_id: match.ride_id
//         });
//       }
//     }

//     if (emailBatch.length === 0) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'No emails to send (missing email addresses)',
//         sent: 0
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     if (dry_run) {
//       return new Response(JSON.stringify({
//         success: true,
//         message: 'Dry run - no emails sent',
//         would_send: emailBatch.length,
//         preview: emailBatch.slice(0, 3).map(e => ({
//           to: e.to,
//           subject: e.subject
//         }))
//       }), {
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       });
//     }

//     // Send emails in batches of 100
//     // Track by (user_id, ride_id) pairs since a user can be in multiple ride groups
//     const successfulMatches: Array<{ user_id: string; ride_id: number }> = [];
//     const failedMatches: Array<{ user_id: string; ride_id: number }> = [];
//     let totalSent = 0;

//     for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
//       const batch = emailBatch.slice(i, i + BATCH_SIZE);
//       const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE);

//       try {
//         const emailResponse = await fetch('https://api.resend.com/emails/batch', {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(batch)
//         });

//         if (!emailResponse.ok) {
//           const errorText = await emailResponse.text();
//           console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorText);

//           // Entire batch failed - mark all as failed
//           for (const meta of batchMetadata) {
//             failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//           }
//           continue;
//         }

//         const batchResult = await emailResponse.json();
//         const sentIds = batchResult.data || [];

//         // Resend returns email IDs in the same order as the requests
//         // Only mark as successful if we got an ID back for that email
//         if (sentIds.length === batch.length) {
//           // All emails in batch were successful
//           for (const meta of batchMetadata) {
//             successfulMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//             totalSent++;
//           }
//           console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Sent ${sentIds.length} emails`);
//         } else {
//           // Partial success - only mark the ones that got IDs back
//           // Resend batch API returns IDs in same order as requests
//           for (let j = 0; j < sentIds.length; j++) {
//             successfulMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//             totalSent++;
//           }
//           // Mark remaining as failed
//           for (let j = sentIds.length; j < batchMetadata.length; j++) {
//             failedMatches.push({ user_id: batchMetadata[j].user_id, ride_id: batchMetadata[j].ride_id });
//           }
//           console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Partial success - ${sentIds.length}/${batch.length} emails sent`);
//         }
//       } catch (error) {
//         console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
//         // Entire batch failed - mark all as failed
//         for (const meta of batchMetadata) {
//           failedMatches.push({ user_id: meta.user_id, ride_id: meta.ride_id });
//         }
//       }
//     }

//     // Mark emails as sent for successful sends
//     // Update each (user_id, ride_id) pair individually since a user can be in multiple rides
//     let updatedCount = 0;
//     let errorCount = 0;

//     if (successfulMatches.length > 0) {
//       console.log(`Attempting to update ${successfulMatches.length} matches as email_sent = true`);

//       // Update each match individually - most reliable way to ensure exact (user_id, ride_id) pairs are updated
//       for (const match of successfulMatches) {
//         const { data, error: updateError } = await supabase
//           .from('Matches')
//           .update({ email_sent: true })
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .eq('source', 'ml')
//           .eq('is_verified', true)
//           .select(); // Verify rows were actually updated

//         if (updateError) {
//           errorCount++;
//           console.error(`Failed to update email_sent for user ${match.user_id}, ride ${match.ride_id}:`, {
//             error: updateError.message,
//             code: updateError.code,
//             details: updateError.details
//           });
//         } else if (data && data.length > 0) {
//           // Rows were successfully updated
//           updatedCount++;
//         } else {
//           // No error but no rows updated - row doesn't match criteria
//           errorCount++;
//           console.warn(`No rows updated for user ${match.user_id}, ride ${match.ride_id} - check if row exists with matching criteria`);
//         }
//       }

//       if (updatedCount > 0) {
//         console.log(`✅ Successfully marked ${updatedCount} matches as email_sent = true`);
//       }

//       if (errorCount > 0) {
//         console.error(`❌ Failed to update ${errorCount} matches - check logs above`);
//       }

//       if (updatedCount === 0 && errorCount === 0) {
//         console.warn(`⚠️ No matches were updated - possible issues:
//           - email_sent column may not exist (run migration)
//           - Matches may already have email_sent = true
//           - Row may not match criteria (user_id, ride_id, source, is_verified)`);
//       }

//     } else {
//       console.warn('No successful matches to update - no emails were sent successfully');
//     }

//     // Verify updates were successful - check a sample
//     let verifiedCount = 0;
//     if (successfulMatches.length > 0) {
//       const sampleSize = Math.min(5, successfulMatches.length);
//       for (let i = 0; i < sampleSize; i++) {
//         const match = successfulMatches[i];
//         const { data } = await supabase
//           .from('Matches')
//           .select('email_sent')
//           .eq('user_id', match.user_id)
//           .eq('ride_id', match.ride_id)
//           .eq('source', 'ml')
//           .single();

//         if (data?.email_sent === true) {
//           verifiedCount++;
//         }
//       }
//     }

//     return new Response(JSON.stringify({
//       success: true,
//       message: 'Batch email sending complete',
//       sent: totalSent,
//       failed: failedMatches.length,
//       total: emailBatch.length,
//       successful_matches_count: successfulMatches.length,
//       database_updated_count: updatedCount,
//       verified_sample: verifiedCount,
//       successful_matches: successfulMatches,
//       failed_matches: failedMatches
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//     });

//   } catch (error) {
//     console.error('Error in send-all-match-emails-batch:', error);
//     return new Response(JSON.stringify({
//       error: error.message,
//       stack: error.stack
//     }), {
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
//       status: 500
//     });
//   }
// });
