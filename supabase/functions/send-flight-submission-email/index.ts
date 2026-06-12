// supabase/functions/send-flight-submission-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }
  try {
    // Basic auth gate (optional, but recommended)
    // const incomingAuth = req.headers.get("authorization") ?? "";
    // const expectedAuth = Deno.env.get("EDGE_AUTH") ?? "";
    // if (!expectedAuth || incomingAuth !== expectedAuth) {
    //   return new Response(JSON.stringify({
    //     error: "Unauthorized"
    //   }), {
    //     status: 401,
    //     headers: {
    //       ...corsHeaders,
    //       "Content-Type": "application/json"
    //     }
    //   });
    // }
    const {
      user_id,
      flight_id,
      airline_iata,
      flight_no,
      airport,
      date,
      earliest_time,
      latest_time,
      to_airport,
    } = await req.json()
    if (!user_id || !flight_id) {
      throw new Error('Missing required fields: user_id and flight_id')
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    // Fetch user (source of truth for email & name)
    const { data: userData, error: userErr } = await supabase
      .from('Users')
      .select('firstname, lastname, email')
      .eq('user_id', user_id)
      .single()
    if (userErr) throw new Error(`Users fetch error: ${userErr.message}`)
    // Fetch flight (source of truth for details; fallback to payload if any field is null)
    const { data: flightData, error: flightErr } = await supabase
      .from('Flights')
      .select(
        'date, airport, earliest_time, latest_time, to_airport, airline_iata, flight_no, terminal, bag_no, bag_no_large, bag_no_personal, max_price, max_dropoff',
      )
      .eq('flight_id', flight_id)
      .single()
    if (flightErr) throw new Error(`Flights fetch error: ${flightErr.message}`)
    // Compose display-friendly values with safe fallbacks
    const f = flightData ?? {}
    const displayDate = f.date ?? date ?? ''
    const displayAirport = f.airport ?? airport ?? ''
    const displayAirline = f.airline_iata ?? airline_iata ?? ''
    const displayFlightNo = f.flight_no ?? flight_no ?? ''
    const displayEarliest = f.earliest_time ?? earliest_time ?? ''
    const displayLatest = f.latest_time ?? latest_time ?? ''
    const displayToAirport = f.to_airport ?? to_airport ?? false
    const direction = displayToAirport
      ? `Campus → ${displayAirport}`
      : `${displayAirport} → Campus`
    // Optional: simple text version for better deliverability
    const textBody = `
Hi ${userData?.firstname ?? 'there'},

Thanks for submitting your flight to PICKUP — we’ve received it!

Flight details:
- Date: ${displayDate}
- Route: ${direction}
- Time window: ${displayEarliest}–${displayLatest}
- Airline / Flight: ${displayAirline} ${displayFlightNo}

You can view or update your submission here:
https://p-ickup.com/questionnaires

If anything looks off, edit your flight to improve your match quality.

— The PICKUP Team
`.trim()
    // HTML email
    const TURQ = '#06b6d4' // swap to your brand turquoise if different

    const htmlBody = `
<!-- Preheader (hidden in most clients, boosts deliverability/preview) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  We received your flight. Manage or update your details.
</div>

<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; line-height:1.5;">
  <!-- Uniqueness hint near top to prevent Gmail trimming across tests -->
  <div style="font-size:0; height:0; overflow:hidden;">id:${flight_id}&#8203;</div>

  <h2 style="color:${TURQ}; margin: 0 0 10px 0;">We got your flight submission ✈️</h2>
  <p style="margin:0 0 16px 0;">Hi ${userData?.firstname ?? 'there'}, thanks for submitting your flight to <strong>PICKUP</strong>! We’ll use these details to find you the best ride match.</p>

  <div style="background:#f7f9fb; padding:16px 20px; border-radius:10px; margin:20px 0;">
    <h3 style="margin:0 0 10px 0; color:#222;">Your flight</h3>
    <ul style="list-style:none; padding:0; margin:0;">
      <li><strong>Date:</strong> ${displayDate}</li>
      <li><strong>Route:</strong> ${direction}</li>
      <li><strong>Time window:</strong> ${displayEarliest} – ${displayLatest}</li>
      <li><strong>Airline / Flight:</strong> ${displayAirline || '—'} ${displayFlightNo || ''}</li>
    </ul>
  </div>

  <div style="text-align:center; margin:24px 0;">
    <a href="https://p-ickup.com/questionnaires"
       target="_blank" rel="noopener"
       style="background:${TURQ}; color:#fff; padding:12px 22px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:600;">
      View / Update Your Flight
    </a>
  </div>

  <p style="color:#555; margin:0 0 20px 0;">Tip: keeping your time window and baggage info accurate helps us find better matches faster.</p>

  <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
  <p style="color:#666; font-size:12px; margin:0;">— The PICKUP Team</p>
</div>
`.trim()

    // and update your send call to use the unique subject
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PICKUP <match@notify.p-ickup.com>',
        to: [userData?.email || user_id],
        subject: 'PICKUP: Flight received ✔︎', // <- use the unique subject here
        text: textBody, // keep your text part (quick to scan, good for inboxing)
        html: htmlBody,
      }),
    })

    if (!emailResponse.ok) {
      const err = await emailResponse.text()
      throw new Error(`Email service error: ${emailResponse.status} - ${err}`)
    }
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Flight submission email sent',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('send-flight-submission-email error:', error)
    return new Response(
      JSON.stringify({
        error: `${error.message ?? error}`,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
