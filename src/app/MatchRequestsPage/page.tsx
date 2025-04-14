'use client'

import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

type MatchRequest = {
  id: string
  sender_id: string
  receiver_id: string
  flight_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export default function MatchRequestsPage() {
  const supabase = createBrowserClient()
  const [requests, setRequests] = useState<MatchRequest[]>([])
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
      console.log('Logged-in user ID:', user.id)

      const { data, error: fetchError } = await supabase
        .from('MatchRequests')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')

      if (fetchError) {
        console.error('Error fetching match requests:', fetchError)
        return
      }

      console.log('Raw pending requests for this user:', data)
      setRequests(data || [])
    }

    load()
  }, [])

  const updateRequest = async (
    id: string,
    newStatus: 'accepted' | 'rejected',
    senderId: string,
  ) => {
    const { error } = await supabase
      .from('MatchRequests')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error && newStatus === 'accepted') {
      await supabase
        .from('Flights')
        .update({ matched: true })
        .in('user_id', [userId, senderId])
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
              <p className="text-lg">
                <strong>{req.sender_id}</strong> wants to ride with you.
              </p>
              <p className="text-sm text-gray-600">
                Flight ID: {req.flight_id}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  onClick={() =>
                    updateRequest(req.id, 'accepted', req.sender_id)
                  }
                >
                  Accept
                </button>
                <button
                  className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  onClick={() =>
                    updateRequest(req.id, 'rejected', req.sender_id)
                  }
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
