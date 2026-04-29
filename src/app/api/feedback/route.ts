import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { getFeedbackRides, submitFeedback } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const result = await getFeedbackRides({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load feedback options.')
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

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
}
