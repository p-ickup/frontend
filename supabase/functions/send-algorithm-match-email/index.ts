import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
// Brand turquoise (swap to your exact hex if different)
const TURQ = '#06b6d4'
function toAmPm(timeStr) {
  if (!timeStr) return ''
  const [hourStr, minuteStr] = timeStr.split(':')
  let hour = parseInt(hourStr, 10)
  const minute = minuteStr.padStart(2, '0')
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12 // converts 0 → 12, 13 → 1, etc.
  return `${hour}:${minute} ${ampm}`
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
        Deno.env.get('SUPABASE_ANON_KEY') ??
        '',
    )
    const { user_id, ride_id, flight_id } = await req.json()
    // Get user details
    const { data: userData } = await supabase
      .from('Users')
      .select('firstname, lastname, email, phonenumber')
      .eq('user_id', user_id)
      .single()
    // Get flight details
    const { data: flightData } = await supabase
      .from('Flights')
      .select(
        `
        date, 
        airport, 
        earliest_time, 
        latest_time, 
        to_airport
      `,
      )
      .eq('flight_id', flight_id)
      .single()
    // Get other users in the same ride group (including emails)
    const { data: groupMembers } = await supabase
      .from('Matches')
      .select(
        `
      user_id,
      flight_id,
      Users(firstname, lastname, email, phonenumber),
      Flights(date, airport, earliest_time, latest_time, to_airport)
    `,
      )
      .eq('ride_id', ride_id)
      .neq('user_id', user_id)
    // Get this user's match row (to read is_subsidized, voucher, contingency_voucher, date, time)
    const { data: myMatch } = await supabase
      .from('Matches')
      .select('is_subsidized, voucher, contingency_voucher, date, time')
      .eq('user_id', user_id)
      .eq('ride_id', ride_id)
      .single()
    // ride-level values (fallbacks to flight values if match-specific values missing)
    const rideDate = myMatch?.date ?? flightData?.date
    // const earliest = toAmPm(flightData?.earliest_time);
    // const latest   = toAmPm(flightData?.latest_time);
    const rideTime = myMatch?.time ? toAmPm(myMatch.time) : ''
    // const rideTime = myMatch?.time ?? `${flightData?.earliest_time ?? ''}${flightData?.earliest_time && flightData?.latest_time ? ' - ' + flightData.latest_time : ''}`;
    const airport = flightData?.airport ?? ''
    // helper for rendering group member list
    // const renderGroupList = (members)=>{
    //   if (!members || members.length === 0) return '<li>No other group members found.</li>';
    //   return members.map((member)=>`
    //     <li style="margin-bottom: 10px;">
    //       <strong>${member.Users?.firstname || ''} ${member.Users?.lastname || ''}</strong><br>
    //       <small>${member.Users?.email ? member.Users.email : ''}</small>
    //       <small>${member.Users?.phonenumber ? member.Users.phonenumber : ''}</small>
    //     </li>
    //   `).join('');
    // };
    const renderGroupList = (members) => {
      if (!members || members.length === 0)
        return '<li>No other group members found.</li>'
      return members
        .map((member) => {
          const email = member.Users?.email || ''
          const phone = member.Users?.phonenumber || ''
          const contact = [email, phone].filter(Boolean).join(' · ') // clean + readable
          return `
        <li style="margin-bottom: 10px;">
          <strong>${member.Users?.firstname || ''} ${member.Users?.lastname || ''}</strong><br>
          <small>${contact}</small>
        </li>
      `
        })
        .join('')
    }
    const contingencyBlock =
      !flightData?.to_airport && myMatch?.contingency_voucher
        ? `
      <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 20px;">
        <h4 style="margin-top: 0;">Flight Delays &amp; Contingency Vouchers</h4>
        <p>If your flight is delayed or canceled by the airline:</p>
        <ol>
          <li> First contact RideLink: email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> or call/text <a href="tel:9093475295"> (909)347-5295</a> (phone support available from U.S./Canada only). Text your group members. </li>
          <li>If regrouping is not possible OR if RideLink staff do not respond within 15 minutes of your arrival, you may use your contingency voucher (linked at the bottom of this email).</li>
        </ol>
        <p><strong>Important:</strong> You must submit the Delay Verification Form (found <a href="https://p-ickup.com/aspc-info">here</a>) within 24 hours of arrival. Failure to submit may result in being billed for the ride.</p>
        <p>Contingency vouchers are only valid for airline-initiated disruptions (not missed flights, voluntary rebooking, or convenience).</p>
        <p>Your contingency voucher code is: <strong><a href="${myMatch.contingency_voucher}">${myMatch.contingency_voucher}</a></strong></p>
        <p><strong>While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</strong></p>
      </div>
    `
        : `
      <div style="background:#fff3cd;padding:16px;border-radius:8px;margin-top:20px;">
        <p><strong>Important:</strong> While most changes cannot be accommodated after the matching deadline, please make sure to contact RideLink if your plans change.</p>
      </div>
    `
    // choose email body depending on subsidy and flight direction
    const emailHtml = myMatch?.is_subsidized
      ? flightData?.to_airport
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${TURQ};">Hello ${userData?.firstname || 'there'}!</h2>
          <p>You’ve been successfully matched for your upcoming Airport Rideshare trip, covered by ASPC RideLink!</p>

          <h3 style="margin-top:0;">Please review your group details and departure instructions below:</h3>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">
               <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">
                  Ride Details
                </a>
            </h3>
              <ul style="list-style: none; padding: 0;">
              <li><strong>Date:</strong> ${rideDate}</li>
              <li><strong>Time:</strong> ${rideTime}</li>
              <li><strong>Airport:</strong> ${airport}</li>
            </ul>
          </div>

          <p><strong>Meeting Point:</strong> 647 N College Way (outside Lincoln Hall), please arrive 10 minutes before the departure time listed above.</p>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
            <ul style="list-style: none; padding: 0;">
              ${renderGroupList(groupMembers)}
            </ul>
          </div>

          <div style="background:#ffffff; padding: 16px; border-radius:8px; margin-top:10px;">
            <h4 style="margin-top:0;">Voucher</h4>
            <p><span style="background-color: yellow;">Please do not click on this link until your group is ready to request the ride.</span> Use this unique Uber Voucher link to book your group’s ride: <strong><a href="${myMatch.voucher}">${myMatch.voucher}</a></strong></p>
            <p>Only one group member needs to request the ride; the voucher will automatically apply to cover the fare. <strong>Tips are not covered </strong> and bill to card on file (set by Uber); group is responsible to split if desired. </p>
            <p>If your group needs to stop at multiple terminals, <strong>add all stops before requesting the ride.</strong></p>
            <p>If your group has <strong>4 or more people</strong> and/or more than <strong>4 suitcases</strong>, you <strong>may request an Uber XL or Uber XXL</strong> as needed.</p>

          </div>

          ${contingencyBlock}

          <p style="color: #666; font-size: 12px;">
            For any policy questions or support, please review the FAQ at <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a> or email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a>.
          </p>

          <p style="color:#666; font-size:14px;">
            Safe travels,<br>
            The PICKUP Team<br>
            In partnership with ASPC RideLink
          </p>
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${TURQ};">Hello ${userData?.firstname || 'there'}!</h2>
          <p>Welcome back! You’ve been matched for your Airport Rideshare return trip to campus, subsidized by ASPC.</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">
               <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">
                  Ride Details
                </a>
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

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: ${TURQ};">Your Group</h3>
            <ul style="list-style: none; padding: 0;">
              ${renderGroupList(groupMembers)}
            </ul>
          </div>

          <div style="background:#ffffff; padding: 16px; border-radius:8px; margin-top:10px;">
            <h4 style="margin-top:0;">Voucher</h4>
            <p><span style="background-color: yellow;">Please do not click on this link until your group is ready to request the ride.</span> Use this unique Uber Voucher link to book your group’s ride: <strong><a href="${myMatch.voucher}">${myMatch.voucher}</a></strong></p>
            <p>Only one group member needs to request the ride; the voucher will automatically apply to cover the fare. <strong>Tips are not covered </strong> and bill to card on file (set by Uber); group is responsible to split if desired. </p>
            <p>If your group needs to stop at multiple terminals, <strong>add all stops before requesting the ride.</strong></p>
            <p>If your group has <strong>4 or more people</strong> and/or more than <strong>4 suitcases</strong>, you <strong>may request an Uber XL or Uber XXL</strong> as needed.</p>
          </div>

          ${contingencyBlock}

          <p>
            If you have any questions about ASPC’s Airport Rideshare program, please visit the policy guide at 
            <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a> or email 
            <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a>. Call/text <a href="tel:9093475295"> (909)347-5295</a> for support.
          </p>

          <p style="color:#666; font-size:14px;">
            We hope you had a safe trip, and welcome back to campus!<br>
            The PICKUP Team<br>
            In partnership with ASPC RideLink
          </p>
        </div>
      `
      : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${TURQ};">Hello ${userData?.firstname || 'there'}!</h2>
        <p>Thank you for submitting a ride request for ASPC Subsidized Rideshare. We reviewed your travel request, and unfortunately could not find a group to be subsidized by ASPC, but you can still share a rideshare with the following group.</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">
               <a href="https://p-ickup.com/results" style="color: #333; text-decoration: none;">
                  Ride Details
                </a>
            </h3>
              <ul style="list-style: none; padding: 0;">
              <li><strong>Date:</strong> ${rideDate}</li>
              <li><strong>Time:</strong> ${rideTime}</li>
              <li><strong>Airport:</strong> ${airport}</li>
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your Group</h3>
          <ul style="list-style: none; padding: 0;">
            ${renderGroupList(groupMembers)}
          </ul>
        </div>

        <p> We have placed your group on the <a href="https://p-ickup.com/unmatched">Unmatched Page</a>, and if you are able to satisfy the requirement of 3+ riders (all Pomona) to LAX or 2+ riders (all Pomona) to ONT, then email <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher. </p>

        <p>We encourage you to use your group to save on costs by carpooling with Uber/Lyft, or to explore alternatives such as the Foothill Transit bus (serving ONT) or Metrolink/FlyAway (serving LAX).</p>

        <p>
          If you have any questions about ASPC’s Airport Rideshare program, please contact 
          <a href="mailto:ridelink@aspc.pomona.edu">ridelink@aspc.pomona.edu</a> 
          or view ASPC info page at 
          <a href="https://p-ickup.com/aspc-info">p-ickup.com/aspc-info</a>.
        </p>

        <p>Safe travels,<br>The P-ICKUP Team<br></p>
      </div>
    `
    // Send email via Resend (same auth headers and endpoint as before)
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PICKUP <match@notify.p-ickup.com>',
        to: [userData?.email || user_id],
        cc: ['ridelink@aspc.pomona.edu'],
        subject: myMatch?.is_subsidized
          ? 'PICKUP — Your ASPC-subsidized ride group!'
          : 'PICKUP — Your ride group!',
        html: emailHtml,
        reply_to: ['pickup.pai.47@gmail.com', 'ridelink@aspc.pomona.edu'],
      }),
    })
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      throw new Error(
        `Email service error: ${emailResponse.status} - ${errorText}`,
      )
    }
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Algorithm match email sent successfully',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Error in send-algorithm-match-email:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    )
  }
})
