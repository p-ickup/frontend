// supabase/functions/delays-sweep/index.ts
// Run by the delays-sweep-20 cron job, which must send the service role key.
import { requireServiceRole } from '../_shared/auth.ts'
import { type FlightUpdate, processUpdate } from './processUpdate.ts'
// flip this flag to true locally to simulate delays/cancellations
// const TEST_MODE = true;
Deno.serve(async (req) => {
  const unauthorized = requireServiceRole(req)
  if (unauthorized) return unauthorized

  const airports = ['LAX', 'ONT']
  const results = []
  const apiKey = Deno.env.get('AIRLABS_API_KEY')
  if (!apiKey) {
    console.error('No AIRLABS_API_KEY set')
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Missing API key',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    )
  }
  for (const airport of airports) {
    const url = `https://airlabs.co/api/v9/schedules?api_key=${apiKey}&arr_iata=${airport}`
    // const url = `https://airlabs.co/api/v9/delays?api_key=${apiKey}&arr_iata=${airport}&delay=30&type=arrivals`;
    const res = await fetch(url)
    const json = await res.json()
    // Keep using schedules API but with premium fields
    for (const f of json.response ?? []) {
      // ✅ Skip flights that are no longer relevant
      if (
        f.status === 'landed' ||
        f.status === 'completed' ||
        f.status === 'arrived'
      ) {
        console.log('Skipping completed flight:', f.flight_number)
        continue
      }
      if (!f.airline_iata || !f.flight_number || !f.arr_iata) {
        console.log('Skipping flight with missing critical data:', f)
        continue
      }
      const update: FlightUpdate = {
        airline_iata: f.airline_iata,
        flight_no: f.flight_number,
        airport: f.arr_iata,
        status: f.status,
        // dep_estimated_utc: f.dep_estimated_utc,  // ✅ Real-time estimated departure
        arr_estimated_utc: f.arr_estimated_utc,
        delayed: f.arr_delayed || 0, // ✅ Arrival delay
      }
      // console.log("🔍 Update Object:", update);
      const outcome = await processUpdate(update)
      results.push({
        airport,
        flight: update.flight_no,
        airline_iata: update.airline_iata,
        outcome,
      })
    }
    // for (const f of json.response ?? []){
    //   // base update built from *free tier* fields
    //   let update = {
    //     airline_iata: f.airline_iata,
    //     flight_no: f.flight_number,
    //     airport: f.arr_iata,
    //     // free tier gives us only scheduled times
    //     status: "scheduled",
    //     dep_estimated_utc: f.dep_time,
    //     arr_estimated_utc: f.arr_time,
    //     delayed: 120 // assume no delay
    //   };
    //   // if (TEST_MODE) {
    //   //   // randomly inject fake delays and cancellations to test the pipeline
    //   //   const fakeDelay = Math.random() < 0.5 ? Math.floor(Math.random() * 180) : 0;
    //   //   const fakeStatus = Math.random() < 0.1 ? "cancelled" : update.status;
    //   //   update = {
    //   //     ...update,
    //   //     status: fakeStatus,
    //   //     delayed: fakeDelay
    //   //   };
    //   // }
    //   const outcome = await processUpdate(update);
    //   results.push({
    //     airport,
    //     flight: update.flight_no,
    //     airline_iata: update.airline_iata,
    //     outcome
    //   });
    // }
  }
  return new Response(
    JSON.stringify(
      {
        ok: true,
        results,
      },
      null,
      2,
    ),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
})
