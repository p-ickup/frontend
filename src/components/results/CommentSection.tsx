'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Database } from '@/lib/database.types'

type Comment = Database['public']['Tables']['Comments']['Row']
type User = Database['public']['Tables']['Users']['Row']

// Extend Comment to include optional joined user data
type CommentWithUser = Comment & {
  user?: User
}

export default function CommentSection({
  comments,
  rideId,
}: {
  comments: CommentWithUser[]
  rideId: number
}) {
  const [newComment, setNewComment] = useState('')
  const [commentList, setCommentList] = useState<CommentWithUser[]>(comments)
  const supabase = createBrowserClient()
  const { user } = useAuth()
  const [userDetails, setUserDetails] = useState<User | null>(null)

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

  const handleAddComment = async () => {
    const trimmed = newComment.trim()
    if (!trimmed || !user || !userDetails) return

    // Optimistic update placeholder with a temporary id
    const optimisticComment: CommentWithUser = {
      id: -1, // Add a temporary id for optimistic update
      ride_id: rideId,
      user_id: user.id,
      comment: trimmed,
      created_at: new Date().toISOString(),
      user: userDetails, // Using full user details
    }

    // Update state optimistically
    setCommentList((prev) => [...prev, optimisticComment])
    setNewComment('')

    // const { data: userData, error: userError } = await supabase.auth.getUser();
    // console.log("Auth user:", userData?.user);

    // console.log("Inserting with userId:", user.id);
    const { data, error } = await supabase
      .from('Comments')
      .insert({
        ride_id: rideId,
        user_id: user.id,
        comment: trimmed,
      })
      .select('*, user:Users(user_id, firstname)') // You can adjust the select query as needed
      .single()

    if (error || !data) {
      console.error('Error adding comment:', error)
      // Rollback optimistic update by removing the temporary comment
      setCommentList((prev) =>
        prev.filter((c) => c.id !== optimisticComment.id),
      )
    } else {
      // Replace temp comment with actual one
      setCommentList((prev) =>
        prev.map((c) => (c.id === optimisticComment.id ? data : c)),
      )
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
