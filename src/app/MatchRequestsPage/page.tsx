'use client'

import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

export default function MatchRequestsPage() {
  const supabase = createBrowserClient()
  const [requests, setRequests] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        console.error('User not authenticated')
        return
      }

      setUserId(user.id)

      const { data, error: fetchError } = await supabase
        .from('MatchRequests')
        .select(
          `*,
          sender_flight:Flights!MatchRequests_sender_flight_id_fkey(
            flight_id, airport, earliest_time, latest_time, date, user_id, to_airport,
            Users (firstname, lastname)
          )
        `,
        )
        .eq('receiver_id', user.id)
        .eq('status', 'pending')

      if (fetchError) {
        console.error('Error fetching match requests:', fetchError)
        return
      }

      setRequests(data || [])
    }

    load()
  }, [])

  const handleAccept = async (req: any) => {
    const { id, sender_id, sender_flight_id, receiver_flight_id } = req

    const { error: updateStatusErr } = await supabase
      .from('MatchRequests')
      .update({ status: 'accepted' })
      .eq('id', id)

    if (updateStatusErr) {
      console.error('Failed to update status:', updateStatusErr)
      return
    }

    const { data: existingReceiverMatch, error: receiverMatchErr } =
      await supabase
        .from('Matches')
        .select('ride_id')
        .eq('user_id', userId)
        .limit(1)
        .single()

    const useRideId =
      !receiverMatchErr && existingReceiverMatch?.ride_id
        ? existingReceiverMatch.ride_id
        : (() => {
            return supabase
              .from('Matches')
              .select('ride_id')
              .order('ride_id', { ascending: false })
              .limit(1)
              .then((res) => (res.data?.[0]?.ride_id ?? 0) + 1)
          })()

    let finalRideId: number

    if (typeof useRideId === 'number') {
      finalRideId = useRideId
    } else {
      finalRideId = await useRideId
    }

    const created_at = new Date().toISOString()

    const insertRes = await supabase.from('Matches').insert([
      {
        ride_id: finalRideId,
        user_id: sender_id,
        flight_id: sender_flight_id,
        created_at,
      },
    ])

    if (insertRes.error) {
      console.error('Error inserting matches:', insertRes.error)
      return
    }

    const updateSender = await supabase
      .from('Flights')
      .update({ matched: true })
      .eq('flight_id', sender_flight_id)

    const updateReceiver = await supabase
      .from('Flights')
      .update({ matched: true })
      .eq('flight_id', receiver_flight_id)

    if (updateSender.error || updateReceiver.error) {
      console.error(
        'Failed to update matched flags:',
        updateSender.error,
        updateReceiver.error,
      )
    } else {
      console.log('Flights updated to matched')
    }

    const { error: deleteRequestErr } = await supabase
      .from('MatchRequests')
      .delete()
      .eq('id', id)

    if (deleteRequestErr) {
      console.error(
        'Failed to delete MatchRequest after match:',
        deleteRequestErr,
      )
    } else {
      console.log('MatchRequest deleted after match')
    }

    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  const handleReject = async (id: string) => {
    const { error: updateError } = await supabase
      .from('MatchRequests')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to reject request:', updateError)
      return
    }

    const { error: deleteError } = await supabase
      .from('MatchRequests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete rejected request:', deleteError)
      return
    }

    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <h1 className="mb-6 text-2xl font-bold">Incoming Match Requests</h1>

      {requests.length === 0 ? (
        <p className="text-gray-500">No new requests.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((req) => (
            <li key={req.id} className="rounded bg-white p-4 shadow">
              <p className="text-lg font-semibold">
                {req.sender_flight?.Users?.firstname}{' '}
                {req.sender_flight?.Users?.lastname} wants to ride with you.
              </p>
              <p className="text-sm text-gray-700">
                Flight Date: {req.sender_flight?.date}
              </p>
              <p className="text-sm text-gray-700">
                Direction:{' '}
                {req.sender_flight?.to_airport
                  ? `School → ${req.sender_flight?.airport}`
                  : `${req.sender_flight?.airport} → School`}
              </p>
              <p className="text-sm text-gray-700">
                Earliest: {req.sender_flight?.earliest_time}
              </p>
              <p className="text-sm text-gray-700">
                Latest: {req.sender_flight?.latest_time}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  onClick={() => handleAccept(req)}
                >
                  Accept
                </button>
                <button
                  className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  onClick={() => handleReject(req.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
