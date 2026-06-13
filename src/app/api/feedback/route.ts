import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { getFeedbackRides, submitFeedback } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  try {
    const result = await getFeedbackRides({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load feedback options.')
  }
})

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const flightId = Number(body?.flightId)
    const overall = Number(body?.overall)
    const convenience = Number(body?.convenience)
    const comments =
      body?.comments == null ? undefined : String(body.comments || '')

    if (!Number.isFinite(flightId)) {
      return badRequestJson('A valid flight ID is required.')
    }
    if (!Number.isFinite(overall) || !Number.isFinite(convenience)) {
      return badRequestJson('Valid ratings are required.')
    }

    const result = await submitFeedback({
      supabase: auth.supabase,
      userId: auth.user.id,
      flightId,
      overall,
      convenience,
      comments,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to submit feedback.')
  }
})
