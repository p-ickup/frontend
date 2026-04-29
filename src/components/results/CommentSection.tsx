'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Database } from '@/lib/database.types'
import { postJson, requestJson } from '@/utils/api'

type Comment = Database['public']['Tables']['Comments']['Row']
type UserSummary = {
  user_id: string
  firstname: string | null
}

type CommentWithUser = Comment & {
  user?: UserSummary | null
}

export default function CommentSection({ rideId }: { rideId: number }) {
  const [newComment, setNewComment] = useState('')
  const [commentList, setCommentList] = useState<CommentWithUser[]>([])
  const { user } = useAuth()
  const [userDetails, setUserDetails] = useState<UserSummary | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when comments update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commentList])

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const result = await requestJson<{
          success: boolean
          comments: CommentWithUser[]
          currentUser: UserSummary | null
        }>(`/api/comments?rideId=${rideId}`)

        setCommentList(result.comments || [])
        setUserDetails(result.currentUser)
      } catch (error) {
        console.error('Error fetching comments:', error)
      }
    }

    void fetchComments()
  }, [rideId, user?.id])

  const handleAddComment = async () => {
    const trimmed = newComment.trim()
    if (!trimmed || !user || !userDetails) return

    const optimisticId = -Date.now()
    const optimisticComment: CommentWithUser = {
      id: optimisticId,
      ride_id: rideId,
      match_id: null,
      user_id: user.id,
      comment: trimmed,
      created_at: new Date().toISOString(),
      user: userDetails,
    }

    setCommentList((prev) => [...prev, optimisticComment])
    setNewComment('')

    try {
      const result = await postJson<{
        success: boolean
        comment: CommentWithUser
      }>('/api/comments', {
        rideId,
        comment: trimmed,
      })

      setCommentList((prev) =>
        prev.map((comment) =>
          comment.id === optimisticId ? result.comment : comment,
        ),
      )
    } catch (error) {
      console.error('Error adding comment:', error)
      setCommentList((prev) => prev.filter((c) => c.id !== optimisticId))
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
          className="flex-1 rounded-md border border-gray-300 bg-white text-sm focus:border-indigo-500 focus:outline-none"
          // className="flex-1 rounded-md border border-gray-300 bg-white text-sm focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
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
