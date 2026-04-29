'use client'

import { postJson, requestJson } from '@/utils/api'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import EmptyState from '@/components/results/EmptyState'

type IncomingMatchRequest = {
  id: string
  sender_flight?: {
    flight_id: number
    airport: string | null
    earliest_time: string | null
    latest_time: string | null
    date: string | null
    user_id: string | null
    to_airport: boolean | null
    Users?: {
      firstname: string | null
      lastname: string | null
    } | null
  } | null
}

export default function MatchRequestsPage() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth()
  const [requests, setRequests] = useState<IncomingMatchRequest[]>([])

  const load = useCallback(async () => {
    if (!user) {
      console.error('User not authenticated')
      return
    }

    try {
      const result = await requestJson<{
        success: boolean
        requests: IncomingMatchRequest[]
      }>('/api/match-requests/incoming')

      setRequests(result.requests || [])
    } catch (fetchError) {
      console.error('Error fetching match requests:', fetchError)
      return
    }
  }, [user])

  useEffect(() => {
    if (user) {
      void load()
    }
  }, [user, load])

  const handleAccept = async (req: any) => {
    try {
      await postJson('/api/match-requests/accept', { id: req.id })
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } catch (error) {
      console.error('Failed to accept request:', error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await postJson('/api/match-requests/reject', { id })
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Failed to reject request:', error)
    }
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-black">
        <h1 className="mb-6 text-2xl font-bold">Incoming Match Requests</h1>
        <div className="flex items-center justify-center py-10">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  // Show login prompt for unauthenticated users
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-black">
        <h1 className="mb-6 text-2xl font-bold">Incoming Match Requests</h1>
        <EmptyState type="login" onLogin={signInWithGoogle} />
      </div>
    )
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
