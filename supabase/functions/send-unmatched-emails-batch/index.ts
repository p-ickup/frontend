// Supabase Edge Function: send-unmatched-emails-batch
// Deploy this to: supabase/functions/send-unmatched-emails-batch/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface UnmatchedFlight {
  flight_id: number
  user_id: string
  date: string
  earliest_time: string
  latest_time: string
  airport: string
  to_airport: boolean
  firstname: string
  lastname: string
  email: string
}

interface EmailPayload {
  from: string
  to: string
  subject: string
  html: string
}

// Helper function to generate email HTML
function generateUnmatchedEmailHtml(
  firstname: string,
  date: string,
  airport: string,
  toAirport: boolean,
): string {
  const direction = toAirport ? 'to' : 'from'
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PICKUP - No Match Found</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
                PICKUP
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                Hello <strong>${firstname}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                Thank you for requesting a rideshare group through <strong>PICKUP x RideLink</strong>! Unfortunately, we weren't able to find a matching group for your requested ride <strong>${direction} ${airport}</strong> on <strong>${formattedDate}</strong>. Since no groups of all Pomona students could be made for your time range, it cannot be subsidized by ASPC.
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                However, you can visit <a href="https://p-ickup.com/unmatched" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/unmatched</a> to view other students and groups who were also unmatched. If their travel times align with yours, we encourage you to reach out and coordinate a rideshare to split costs.
              </p>

              <div style="margin: 24px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
                <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e40af; font-weight: 600;">
                  💡 Voucher Eligibility
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">
                  If you are able to satisfy the requirement of <strong>3+ riders (all Pomona) from LAX</strong> or <strong>2+ riders (all Pomona) from ONT</strong>, then email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.
                </p>
              </div>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                You can look for a confirmation email or visit <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a> to see which of your rides (if any) were successfully matched.
              </p>

              <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Best,<br>
                <strong>PICKUP</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">
                This is an automated message from PICKUP. Please do not reply to this email.<br>
                For questions, contact <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// Rate limiting helper - delays between batches to respect 2 req/sec limit
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { date_start, date_end, dry_run } = await req.json()

    if (!date_start || !date_end) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: date_start and date_end',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch flights in date range that haven't been emailed yet
    // Unmatched = NOT in Matches table (source of truth), not matched=false
    const { data: flightsRaw, error: flightsError } = await supabase
      .from('Flights')
      .select(
        `
        flight_id,
        user_id,
        date,
        earliest_time,
        latest_time,
        airport,
        to_airport,
        Users!inner (
          firstname,
          lastname,
          email
        )
      `,
      )
      .or('unmatched_email_sent.is.null,unmatched_email_sent.eq.false')
      .gte('date', date_start)
      .lte('date', date_end)
      .order('date', { ascending: true })

    if (flightsError) {
      throw new Error(`Database error: ${flightsError.message}`)
    }

    if (!flightsRaw || flightsRaw.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: dry_run
            ? 'Dry run - no emails to send'
            : 'No unmatched flights found that need emails',
          would_send: 0,
          sent: 0,
          failed: 0,
          total: 0,
          preview: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // Get flight_ids that ARE in Matches (matched flights)
    const flightIds = flightsRaw.map((f: any) => f.flight_id)
    const { data: matches, error: matchesError } = await supabase
      .from('Matches')
      .select('flight_id')
      .in('flight_id', flightIds)

    if (matchesError) {
      throw new Error(
        `Database error fetching matches: ${matchesError.message}`,
      )
    }

    const matchedFlightIds = new Set(
      (matches || []).map((m: any) => m.flight_id),
    )

    // Filter to only truly unmatched: NOT in Matches table
    const flights = flightsRaw.filter(
      (f: any) => !matchedFlightIds.has(f.flight_id),
    )

    if (flights.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: dry_run
            ? 'Dry run - no emails to send'
            : 'No unmatched flights found that need emails',
          would_send: 0,
          sent: 0,
          failed: 0,
          total: 0,
          preview: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // Transform to UnmatchedFlight array
    const unmatchedFlights: UnmatchedFlight[] = flights.map((flight: any) => {
      const user = flight.Users
      return {
        flight_id: flight.flight_id,
        user_id: flight.user_id,
        date: flight.date,
        earliest_time: flight.earliest_time,
        latest_time: flight.latest_time,
        airport: flight.airport,
        to_airport: flight.to_airport,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
      }
    })

    // DRY RUN MODE
    if (dry_run) {
      const preview = unmatchedFlights.slice(0, 3).map((flight) => ({
        to: flight.email,
        subject: `PICKUP — No match found for your ride ${flight.to_airport ? 'to' : 'from'} ${flight.airport} on ${flight.date}`,
      }))

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dry run - no emails sent',
          would_send: unmatchedFlights.length,
          preview,
          date_range: { start: date_start, end: date_end },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // ACTUAL SEND MODE
    const emailPayloads: EmailPayload[] = unmatchedFlights.map((flight) => {
      const direction = flight.to_airport ? 'to' : 'from'
      return {
        from: 'PICKUP <match@notify.p-ickup.com>',
        to: flight.email,
        subject: `PICKUP — No match found for your ride ${direction} ${flight.airport} on ${flight.date}`,
        html: generateUnmatchedEmailHtml(
          flight.firstname,
          flight.date,
          flight.airport,
          flight.to_airport,
        ),
        reply_to: 'pickup.pai.47@gmail.com',
      }
    })

    // Send in batches of 100 (Resend batch API limit)
    // Rate limit: 2 requests per second, so 500ms delay between batches
    const BATCH_SIZE = 100
    const DELAY_BETWEEN_BATCHES = 500 // 500ms = 2 req/sec

    let totalSent = 0
    let totalFailed = 0
    const successfulFlightIds: number[] = []
    const failedFlightIds: number[] = []

    for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
      const batch = emailPayloads.slice(i, i + BATCH_SIZE)
      const batchFlights = unmatchedFlights.slice(i, i + BATCH_SIZE)

      try {
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
            errorData,
          )
          totalFailed += batch.length
          batchFlights.forEach((f) => failedFlightIds.push(f.flight_id))
        } else {
          const result = await response.json()
          console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} sent:`, result)
          totalSent += batch.length
          batchFlights.forEach((f) => successfulFlightIds.push(f.flight_id))
        }
      } catch (error) {
        console.error(
          `Error sending batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          error,
        )
        totalFailed += batch.length
        batchFlights.forEach((f) => failedFlightIds.push(f.flight_id))
      }

      // Rate limiting: Wait 500ms between batches (2 req/sec)
      if (i + BATCH_SIZE < emailPayloads.length) {
        await delay(DELAY_BETWEEN_BATCHES)
      }
    }

    // Mark flights as emailed for successful sends
    if (successfulFlightIds.length > 0) {
      const { error: updateError } = await supabase
        .from('Flights')
        .update({ unmatched_email_sent: true })
        .in('flight_id', successfulFlightIds)

      if (updateError) {
        console.error('Failed to update unmatched_email_sent:', updateError)
      } else {
        console.log(
          `✅ Marked ${successfulFlightIds.length} flights as unmatched_email_sent = true`,
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${totalSent} unmatched emails`,
        sent: totalSent,
        failed: totalFailed,
        total: emailPayloads.length,
        date_range: { start: date_start, end: date_end },
        successful_flight_ids: successfulFlightIds,
        failed_flight_ids: failedFlightIds,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (error) {
    console.error('Error in send-unmatched-emails-batch:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
})

// // Supabase Edge Function: send-unmatched-emails-batch
// // Deploy this to: supabase/functions/send-unmatched-emails-batch/index.ts

// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
// const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// interface UnmatchedFlight {
//   flight_id: number
//   user_id: string
//   date: string
//   earliest_time: string
//   latest_time: string
//   airport: string
//   to_airport: boolean
//   firstname: string
//   lastname: string
//   email: string
// }

// interface EmailPayload {
//   from: string
//   to: string
//   subject: string
//   html: string
// }

// // Helper function to generate email HTML
// function generateUnmatchedEmailHtml(
//   firstname: string,
//   date: string,
//   airport: string,
//   toAirport: boolean
// ): string {
//   const direction = toAirport ? 'to' : 'from'
//   const formattedDate = new Date(date).toLocaleDateString('en-US', {
//     month: 'numeric',
//     day: 'numeric',
//     year: '2-digit'
//   })

//   return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>PICKUP - No Match Found</title>
// </head>
// <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
//   <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb;">
//     <tr>
//       <td align="center" style="padding: 40px 20px;">
//         <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

//           <!-- Header -->
//           <tr>
//             <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 8px 8px 0 0;">
//               <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
//                 PICKUP
//               </h1>
//             </td>
//           </tr>

//           <!-- Content -->
//           <tr>
//             <td style="padding: 32px;">
//               <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
//                 Hello <strong>${firstname}</strong>,
//               </p>

//               <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
//                 Thank you for requesting a rideshare group through <strong>PICKUP x RideLink</strong>! Unfortunately, we weren't able to find a matching group for your requested ride <strong>${direction} ${airport}</strong> on <strong>${formattedDate}</strong>. Since no groups of all Pomona students could be made for your time range, it cannot be subsidized by ASPC.
//               </p>

//               <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
//                 However, you can visit <a href="https://p-ickup.com/unmatched" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/unmatched</a> to view other students and groups who were also unmatched. If their travel times align with yours, we encourage you to reach out and coordinate a rideshare to split costs.
//               </p>

//               <div style="margin: 24px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
//                 <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e40af; font-weight: 600;">
//                   💡 Voucher Eligibility
//                 </p>
//                 <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">
//                   If you are able to satisfy the requirement of <strong>3+ riders (all Pomona) from LAX</strong> or <strong>2+ riders (all Pomona) from ONT</strong>, then email <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a> at least 24 hours in advance to receive a voucher.
//                 </p>
//               </div>

//               <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
//                 You can look for a confirmation email or visit <a href="https://p-ickup.com/results" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">p-ickup.com/results</a> to see which of your rides (if any) were successfully matched.
//               </p>

//               <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
//                 Best,<br>
//                 <strong>PICKUP</strong>
//               </p>
//             </td>
//           </tr>

//           <!-- Footer -->
//           <tr>
//             <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
//               <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">
//                 This is an automated message from PICKUP. Please do not reply to this email.<br>
//                 For questions, contact <a href="mailto:ridelink@aspc.pomona.edu" style="color: #0ea5e9; text-decoration: none;">ridelink@aspc.pomona.edu</a>
//               </p>
//             </td>
//           </tr>

//         </table>
//       </td>
//     </tr>
//   </table>
// </body>
// </html>
//   `.trim()
// }

// // Rate limiting helper - delays between batches to respect 2 req/sec limit
// async function delay(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

// serve(async (req) => {
//   // CORS headers
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', {
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'POST',
//         'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
//       },
//     })
//   }

//   try {
//     const { date_start, date_end, dry_run } = await req.json()

//     if (!date_start || !date_end) {
//       return new Response(
//         JSON.stringify({
//           success: false,
//           error: 'Missing required parameters: date_start and date_end'
//         }),
//         {
//           status: 400,
//           headers: { 'Content-Type': 'application/json' },
//         }
//       )
//     }

//     // Create Supabase client with service role key
//     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

//     // Fetch unmatched flights that haven't been emailed yet
//     // NO DEDUPLICATION - one email per flight
//     const { data: flights, error: flightsError } = await supabase
//       .from('Flights')
//       .select(`
//         flight_id,
//         user_id,
//         date,
//         earliest_time,
//         latest_time,
//         airport,
//         to_airport,
//         Users!inner (
//           firstname,
//           lastname,
//           email
//         )
//       `)
//       .eq('matched', false)
//       .or('unmatched_email_sent.is.null,unmatched_email_sent.eq.false')
//       .gte('date', date_start)
//       .lte('date', date_end)
//       .order('date', { ascending: true })

//     if (flightsError) {
//       throw new Error(`Database error: ${flightsError.message}`)
//     }

//     if (!flights || flights.length === 0) {
//       return new Response(
//         JSON.stringify({
//           success: true,
//           message: dry_run ? 'Dry run - no emails to send' : 'No unmatched flights found that need emails',
//           would_send: 0,
//           sent: 0,
//           failed: 0,
//           total: 0,
//           preview: []
//         }),
//         {
//           status: 200,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*',
//           },
//         }
//       )
//     }

//     // Transform to UnmatchedFlight array
//     const unmatchedFlights: UnmatchedFlight[] = flights.map(flight => {
//       const user = flight.Users as any
//       return {
//         flight_id: flight.flight_id,
//         user_id: flight.user_id,
//         date: flight.date,
//         earliest_time: flight.earliest_time,
//         latest_time: flight.latest_time,
//         airport: flight.airport,
//         to_airport: flight.to_airport,
//         firstname: user.firstname,
//         lastname: user.lastname,
//         email: user.email,
//       }
//     })

//     // DRY RUN MODE
//     if (dry_run) {
//       const preview = unmatchedFlights.slice(0, 3).map(flight => ({
//         to: flight.email,
//         subject: `PICKUP — No match found for your ride ${flight.to_airport ? 'to' : 'from'} ${flight.airport} on ${flight.date}`
//       }))

//       return new Response(
//         JSON.stringify({
//           success: true,
//           message: 'Dry run - no emails sent',
//           would_send: unmatchedFlights.length,
//           preview,
//           date_range: { start: date_start, end: date_end }
//         }),
//         {
//           status: 200,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*',
//           },
//         }
//       )
//     }

//     // ACTUAL SEND MODE
//     const emailPayloads: EmailPayload[] = unmatchedFlights.map(flight => {
//       const direction = flight.to_airport ? 'to' : 'from'
//       return {
//         from: 'PICKUP <match@notify.p-ickup.com>',
//         to: flight.email,
//         subject: `PICKUP — No match found for your ride ${direction} ${flight.airport} on ${flight.date}`,
//         html: generateUnmatchedEmailHtml(
//           flight.firstname,
//           flight.date,
//           flight.airport,
//           flight.to_airport
//         ),
//         reply_to:'pickup.pai.47@gmail.com'
//       }
//     })

//     // Send in batches of 100 (Resend batch API limit)
//     // Rate limit: 2 requests per second, so 500ms delay between batches
//     const BATCH_SIZE = 100
//     const DELAY_BETWEEN_BATCHES = 500 // 500ms = 2 req/sec

//     let totalSent = 0
//     let totalFailed = 0
//     const successfulFlightIds: number[] = []
//     const failedFlightIds: number[] = []

//     for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
//       const batch = emailPayloads.slice(i, i + BATCH_SIZE)
//       const batchFlights = unmatchedFlights.slice(i, i + BATCH_SIZE)

//       try {
//         const response = await fetch('https://api.resend.com/emails/batch', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${RESEND_API_KEY}`,
//           },
//           body: JSON.stringify(batch),
//         })

//         if (!response.ok) {
//           const errorData = await response.text()
//           console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorData)
//           totalFailed += batch.length
//           batchFlights.forEach(f => failedFlightIds.push(f.flight_id))
//         } else {
//           const result = await response.json()
//           console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} sent:`, result)
//           totalSent += batch.length
//           batchFlights.forEach(f => successfulFlightIds.push(f.flight_id))
//         }
//       } catch (error) {
//         console.error(`Error sending batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error)
//         totalFailed += batch.length
//         batchFlights.forEach(f => failedFlightIds.push(f.flight_id))
//       }

//       // Rate limiting: Wait 500ms between batches (2 req/sec)
//       if (i + BATCH_SIZE < emailPayloads.length) {
//         await delay(DELAY_BETWEEN_BATCHES)
//       }
//     }

//     // Mark flights as emailed for successful sends
//     if (successfulFlightIds.length > 0) {
//       const { error: updateError } = await supabase
//         .from('Flights')
//         .update({ unmatched_email_sent: true })
//         .in('flight_id', successfulFlightIds)

//       if (updateError) {
//         console.error('Failed to update unmatched_email_sent:', updateError)
//       } else {
//         console.log(`✅ Marked ${successfulFlightIds.length} flights as unmatched_email_sent = true`)
//       }
//     }

//     return new Response(
//       JSON.stringify({
//         success: true,
//         message: `Sent ${totalSent} unmatched emails`,
//         sent: totalSent,
//         failed: totalFailed,
//         total: emailPayloads.length,
//         date_range: { start: date_start, end: date_end },
//         successful_flight_ids: successfulFlightIds,
//         failed_flight_ids: failedFlightIds
//       }),
//       {
//         status: 200,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//       }
//     )

//   } catch (error) {
//     console.error('Error in send-unmatched-emails-batch:', error)
//     return new Response(
//       JSON.stringify({
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       }),
//       {
//         status: 500,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//       }
//     )
//   }
// })
