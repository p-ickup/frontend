// Optional: type defs for intellisense in Supabase Edge runtime (not required at runtime)
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// ==========================
// PHASE 1 ENV (no email)
// ==========================
const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
)
function asUtcDate(s) {
  if (!s) return null
  // Payloads often lack 'Z'; treat as UTC explicitly
  return new Date(s.replace(' ', 'T') + 'Z')
}
function minutesBetween(a, b) {
  if (!a || !b) return null
  return Math.round((a.getTime() - b.getTime()) / 60000)
}
function computeDelayMin(u) {
  if (typeof u.delayed === 'number') return u.delayed
  const dep = minutesBetween(
    asUtcDate(u.dep_estimated_utc),
    asUtcDate(u.dep_time_utc),
  )
  const arr = minutesBetween(
    asUtcDate(u.arr_estimated_utc),
    asUtcDate(u.arr_time_utc),
  )
  if (dep == null && arr == null) return null
  return Math.max(dep ?? -Infinity, arr ?? -Infinity)
}
function todayWindowUTC() {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  } // YYYY-MM-DD
}
async function findFlights(u) {
  const { start, end } = todayWindowUTC()
  return supabase
    .from('Flights')
    .select(
      `
      flight_id,
      user_id,
      airline_iata,
      flight_no,
      airport,
      date,
      last_status,
      last_dep_estimated_utc,
      last_arr_estimated_utc,
      last_notified_at,
      last_notified_delay_min
    `,
    )
    .eq('airline_iata', u.airline_iata ?? null)
    .eq('flight_no', u.flight_no ?? null)
    .eq('airport', u.airport ?? null)
    .gte('date', start)
    .lte('date', end)
}
// notify_threshold_min,
// escalate_delta_min,
// cooldown_min

// ==========================
// PHASE 2 (email) helpers — commented out for now
// ==========================
// const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// const POSTMARK_TOKEN = Deno.env.get("POSTMARK_TOKEN");
// const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "updates@example.com";
// function shouldNotify(row: FlightRow, status: string | undefined, delayMin: number | null, now = new Date()) { ... }
// async function rideRecipientsForFlight(flight_id: number) { ... }
// async function sendEmail(to: string[], subject: string, html: string) { ... }
// function renderEmail(status: string | undefined, delay: number | null, u: Update) { ... }
async function processOne(u) {
  // 1) Find candidate flight(s)
  const { data: flights, error } = await findFlights(u)
  if (error) throw error
  if (!flights || flights.length === 0)
    return {
      matched: 0,
    }
  // Optional: compute delay (not used in Phase 1, but handy for logs)
  const delayMin = computeDelayMin(u)
  for (const row of flights) {
    // Always update the snapshot fields (Phase 1 focus)
    const snapUpdate = {
      last_status: u.status ?? row.last_status ?? null,
      last_dep_estimated_utc:
        u.dep_estimated_utc ?? row.last_dep_estimated_utc ?? null,
      last_arr_estimated_utc:
        u.arr_estimated_utc ?? row.last_arr_estimated_utc ?? null,
    }
    // PHASE 2: email logic — disabled
    // const gate = shouldNotify(row, u.status, delayMin, new Date());
    // if (gate.notify) {
    //   const groups = await rideRecipientsForFlight(row.flight_id);
    //   const subject = `Flight update: ${u.airline_iata}${u.flight_no} → ${u.airport} (${delayMin ?? "—"} min)`;
    //   const html = renderEmail(u.status, delayMin, u);
    //   for (const g of groups) {
    //     if (g.emails.length) await sendEmail(g.emails, subject, html);
    //   }
    //   snapUpdate.last_notified_at = new Date().toISOString();
    //   if (delayMin != null) snapUpdate.last_notified_delay_min = delayMin;
    // }
    const { error: upErr } = await supabase
      .from('Flights')
      .update(snapUpdate)
      .eq('flight_id', row.flight_id)
    if (upErr) throw upErr
    console.log(
      JSON.stringify({
        event: 'flight_snapshot_updated',
        flight_id: row.flight_id,
        status: snapUpdate.last_status,
        dep_est_utc: snapUpdate.last_dep_estimated_utc,
        arr_est_utc: snapUpdate.last_arr_estimated_utc,
        delay_min: delayMin,
      }),
    )
  }
  return {
    matched: flights.length,
  }
}
// ==========================
// HTTP handler
// ==========================
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null)
    if (!body)
      return new Response('Bad JSON', {
        status: 400,
      })
    const updates = Array.isArray(body) ? body : [body]
    const results = []
    for (const u of updates) {
      if (!u.airline_iata || !u.flight_no || !u.airport) {
        results.push({
          matched: 0,
          error: 'missing keys',
        })
        continue
      }
      results.push(await processOne(u))
    }
    return new Response(
      JSON.stringify({
        ok: true,
        results,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
