import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { rejectMatchRequest } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const requestId = String(body?.id || '')

    if (!requestId) {
      return badRequestJson('Request ID is required.')
    }

    const result = await rejectMatchRequest({
      supabase: auth.supabase,
      userId: auth.user.id,
      requestId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to reject match request.')
  }
})
