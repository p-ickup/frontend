import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 100

type EmailTemplateData = {
  firstName: string
  airport: string
  flightNumber: string
  terminal: string
  rideDate: string
  rideTime: string
  groupMembers: string
}

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function toAmPm(time: string | null | undefined): string {
  if (!time) return ''

  const [hourText, minuteText = '00'] = time.split(':')
  let hour = Number.parseInt(hourText, 10)

  if (Number.isNaN(hour)) return time

  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12

  return `${hour}:${minuteText.padStart(2, '0')} ${ampm}`
}

function sectionCard(
  title: string,
  content: string,
  color = '#06b6d4',
  background = '#f8fbff',
): string {
  return `
    <div style="
      background:${background};
      border-left:4px solid ${color};
      padding:18px 20px;
      margin:22px 0;
      border-radius:6px;
    ">
      <h3 style="
        margin:0 0 14px;
        color:#164e63;
        font-size:18px;
        line-height:1.3;
      ">
        ${title}
      </h3>

      <div style="color:#222;line-height:1.55;font-size:15px;">
        ${content}
      </div>
    </div>
  `
}

function renderTemplate(template: string, data: EmailTemplateData): string {
  return template
    .replaceAll('{{name}}', escapeHtml(data.firstName))
    .replaceAll('{{airport}}', escapeHtml(data.airport))
    .replaceAll('{{flightNumber}}', escapeHtml(data.flightNumber))
    .replaceAll('{{terminal}}', escapeHtml(data.terminal))
    .replaceAll('{{rideDate}}', escapeHtml(data.rideDate))
    .replaceAll('{{rideTime}}', escapeHtml(data.rideTime))
    .replaceAll('{{groupMembers}}', data.groupMembers)
}

function generateMatchEmailHtml({
  firstName,
  airport,
  flightNumber,
  terminal,
  rideDate,
  rideTime,
  groupMembers,
}: EmailTemplateData): string {
  const name = escapeHtml(firstName || 'there')
  const airportValue = escapeHtml(airport || 'Not provided')
  const flight = escapeHtml(flightNumber || 'Not provided')
  const terminalValue = escapeHtml(terminal || 'Not provided')
  const date = escapeHtml(rideDate || 'Not provided')
  const time = escapeHtml(rideTime || 'Not provided')

  return `
    <div style="
      max-width:640px;
      margin:0 auto;
      padding:0 12px;
      font-family:Arial,sans-serif;
      color:#222;
      line-height:1.55;
      background:#fff;
    ">
      <h2 style="color:#06b6d4;">
        You have been matched!
      </h2>

      <p>
        Hello ${name},
      </p>

      <p>
        You have been matched with a RideLink group for your upcoming trip.
      </p>

      ${sectionCard(
        'Your Trip Details',
        `
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Pickup Time:</strong> ${time}</p>
          <p><strong>Airport:</strong> ${airportValue}</p>
          <p><strong>Flight:</strong> ${flight}</p>
          <p><strong>Terminal:</strong> ${terminalValue}</p>

          <p>
            You can view your RideLink group at
            <a href="https://p-ickup.com/results">
              p-ickup.com/results
            </a>
          </p>
        `,
        '#06b6d4',
        '#f8fbff',
      )}

      ${sectionCard(
        'People in Your Group',
        `
          <ul style="padding-left:20px;margin:0;">
            ${groupMembers || '<li>No other riders are currently listed.</li>'}
          </ul>
        `,
        '#2563eb',
        '#f8fbff',
      )}

      ${sectionCard(
        'Contact ASPC RideLink',
        `
          <p>
            Please save this information before you travel. We also recommend
            writing it down somewhere in case your phone runs out of battery.
          </p>

          <p>
            Email: ridelink@aspc.pomona.edu
          </p>

          <p>
            Call/Text: +1 (909) 347-5295
          </p>

          <p>
            WhatsApp: You can contact the same number through WhatsApp after
            connecting to airport Wi-Fi.
          </p>

          <p>
            If you don't have a U.S. or Canadian phone number, email or WhatsApp
            are the best ways to reach us.
          </p>
        `,
        '#ea580c',
        '#fffaf5',
      )}

      <p>
        Safe travels,<br>
        ASPC RideLink
      </p>
    </div>
  `
}

function buildGroupMembersHtml(matches: any[]): string {
  return matches
    .map((match) => {
      const user = getRelation(match.Users)

      if (!user) return ''

      const fullName = `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim()

      return `<li>${escapeHtml(fullName || 'Rider')}</li>`
    })
    .filter(Boolean)
    .join('')
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

    const {
      dry_run,
      ride_ids,
      date_start,
      date_end,
      custom_subject,
      custom_body,
      ride_date_start,
      ride_date_end,
      airport,
      direction,
    } = await req.json().catch(() => ({}))

    console.log({
      dry_run,
      ride_ids,
      date_start,
      date_end,
      custom_subject,
      custom_body,
      ride_date_start,
      ride_date_end,
      airport,
      direction,
    })

    const isGroupEmail = Array.isArray(ride_ids) && ride_ids.length > 0

    let query = supabase
      .from('Matches')
      .select(
        `
        user_id,
        ride_id,
        flight_id,
        date,
        time,
        email_sent,
        Users(firstname, lastname, email, phonenumber),
        Flights!matches_flight_id_fk(
          date,
          airport,
          flight_no,
          terminal,
          to_airport
        )
      `,
      )
      .or('email_sent.is.null,email_sent.eq.false')

    if (isGroupEmail) {
      query = query.in('ride_id', ride_ids)
    }

    if (date_start) {
      query = query.gte('date', date_start)
    }

    if (date_end) {
      query = query.lte('date', date_end)
    }

    const { data: pendingMatches, error: matchesError } = await query

    if (matchesError) {
      throw new Error(`Failed to fetch matches: ${matchesError.message}`)
    }

    const rideIds = [
      ...new Set(
        (pendingMatches ?? [])
          .map((match) => match.ride_id)
          .filter((rideId) => rideId != null),
      ),
    ]

    let groupMatches: any[] = []

    if (rideIds.length > 0) {
      const { data, error: groupMatchesError } = await supabase
        .from('Matches')
        .select(
          `
          ride_id,
          user_id,
          Users(firstname, lastname, email, phonenumber)
        `,
        )
        .in('ride_id', rideIds)

      if (groupMatchesError) {
        throw new Error(
          `Failed to fetch group members: ${groupMatchesError.message}`,
        )
      }

      groupMatches = data ?? []
    }

    const matchesByRideId = new Map<number, any[]>()

    for (const match of groupMatches) {
      const members = matchesByRideId.get(match.ride_id) ?? []
      members.push(match)
      matchesByRideId.set(match.ride_id, members)
    }

    const emailBatch: any[] = []

    const matchMetadata: Array<{
      user_id: string
      ride_id: number
    }> = []

    for (const match of pendingMatches ?? []) {
      const user = getRelation(match.Users)
      const flight = getRelation(match.Flights)

      if (!user?.email || !flight) {
        continue
      }

      const rideDate = match.date ?? flight.date ?? ''
      const rideTime = toAmPm(match.time)
      const flightNumber = flight.flight_no ? String(flight.flight_no) : ''
      const airport = flight.airport ?? ''
      const terminal = flight.terminal ?? ''

      const membersForRide = matchesByRideId.get(match.ride_id) ?? []

      const groupMembers = buildGroupMembersHtml(membersForRide)

      const templateData: EmailTemplateData = {
        firstName: user.firstname ?? 'there',
        airport,
        flightNumber,
        terminal,
        rideDate,
        rideTime,
        groupMembers,
      }

      const emailHtml = custom_body
        ? renderTemplate(custom_body, templateData)
        : generateMatchEmailHtml(templateData)

      emailBatch.push({
        from: 'ASPC RideLink <match@notify.p-ickup.com>',
        to: [user.email],
        cc: ['ridelink@aspc.pomona.edu'],
        subject: custom_subject || 'Your RideLink Match Information',
        html: emailHtml,
        reply_to: ['ridelink@aspc.pomona.edu', 'pickup.pai.47@gmail.com'],
      })

      matchMetadata.push({
        user_id: match.user_id,
        ride_id: match.ride_id,
      })
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dry run - no emails sent',
          would_send: emailBatch.length,
          preview: emailBatch.slice(0, 3).map((email) => ({
            to: email.to,
            subject: email.subject,
          })),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (emailBatch.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unsent match emails to send',
          sent: 0,
          failed: 0,
          total: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const successfulMatches: Array<{
      user_id: string
      ride_id: number
    }> = []

    const failedMatches: Array<{
      user_id: string
      ride_id: number
    }> = []

    let totalSent = 0

    for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
      const batch = emailBatch.slice(i, i + BATCH_SIZE)
      const batchMetadata = matchMetadata.slice(i, i + BATCH_SIZE)

      try {
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          console.error(`Resend batch failed: ${await response.text()}`)

          failedMatches.push(...batchMetadata)
          continue
        }

        const result = await response.json()

        const sentIds = Array.isArray(result.data) ? result.data : []

        for (let j = 0; j < batchMetadata.length; j++) {
          if (j < sentIds.length) {
            successfulMatches.push(batchMetadata[j])
            totalSent++
          } else {
            failedMatches.push(batchMetadata[j])
          }
        }
      } catch (error) {
        console.error('Resend request failed:', error)
        failedMatches.push(...batchMetadata)
      }
    }

    let databaseUpdatedCount = 0
    let databaseUpdateErrors = 0

    for (const match of successfulMatches) {
      const { data, error } = await supabase
        .from('Matches')
        .update({ email_sent: true })
        .eq('user_id', match.user_id)
        .eq('ride_id', match.ride_id)
        .select()

      if (error) {
        databaseUpdateErrors++

        console.error(
          `Failed to mark email_sent for ${match.user_id}:`,
          error.message,
        )
      } else if (data && data.length > 0) {
        databaseUpdatedCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Match emails sent',
        sent: totalSent,
        failed: failedMatches.length,
        total: emailBatch.length,
        database_updated_count: databaseUpdatedCount,
        database_update_errors: databaseUpdateErrors,
        successful_matches: successfulMatches,
        failed_matches: failedMatches,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Error in send-all-match-emails-batch:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
