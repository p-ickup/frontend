'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Database } from '@/lib/database.types'

type Comment = Database['public']['Tables']['Comments']['Row']
type User = Database['public']['Tables']['Users']['Row']

type CommentWithUser = Comment & {
  user?: User
}

export default function CommentSection({ rideId }: { rideId: number }) {
  const [newComment, setNewComment] = useState('')
  const [commentList, setCommentList] = useState<CommentWithUser[]>([])
  const supabase = createBrowserClient()
  const { user } = useAuth()
  const [userDetails, setUserDetails] = useState<User | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when comments update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commentList])

  useEffect(() => {
    if (user?.id) {
      const fetchUserDetails = async () => {
        const { data, error } = await supabase
          .from('Users')
          .select(
            'user_id, created_at, firstname, lastname, phonenumber, school, photo_url, instagram',
          )
          .eq('user_id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user details:', error)
        } else {
          setUserDetails(data)
        }
      }

      fetchUserDetails()
    }
  }, [user?.id])

  useEffect(() => {
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('Comments')
        .select('*, user:Users(user_id, firstname)')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching comments:', error)
      } else {
        setCommentList(data)
      }
    }

    fetchComments()
  }, [rideId])

  const handleAddComment = async () => {
    const trimmed = newComment.trim()
    if (!trimmed || !user || !userDetails) return

    const optimisticComment: CommentWithUser = {
      id: -1,
      ride_id: rideId,
      user_id: user.id,
      comment: trimmed,
      created_at: new Date().toISOString(),
      user: userDetails,
    }

    setCommentList((prev) => [...prev, optimisticComment])
    setNewComment('')

    const { data, error } = await supabase
      .from('Comments')
      .insert({
        ride_id: rideId,
        user_id: user.id,
        comment: trimmed,
      })
      .select('*, user:Users(user_id, firstname)')
      .single()

    if (error || !data) {
      console.error('Error adding comment:', error)
      setCommentList((prev) =>
        prev.filter((c) => c.id !== optimisticComment.id),
      )
    } else {
      const { data: updatedComments, error: refetchError } = await supabase
        .from('Comments')
        .select('*, user:Users(user_id, firstname)')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (refetchError) {
        console.error('Error refetching comments:', refetchError)
      } else {
        setCommentList(updatedComments)
      }
    }
  }

  return (
    <div className="mt-4 flex max-h-64 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="space-y-2 overflow-y-auto p-3 text-sm text-gray-700">
        {commentList.length > 0 ? (
          commentList.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg bg-gray-100 px-3 py-2 shadow-sm"
            >
              <span className="block font-semibold text-gray-800">
                {comment.user?.firstname || 'Unknown User'}
              </span>
              <span>{comment.comment}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No messages yet.</p>
        )}
        <div ref={bottomRef} /> {/* 👈 Auto-scroll target */}
      </div>
      <div className="mt-auto flex border-t border-gray-200 px-3 py-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={handleAddComment}
          className="ml-2 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={!newComment.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
