import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { acceptMatchRequest } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const requestId = String(body?.id || '')

    if (!requestId) {
      return badRequestJson('Request ID is required.')
    }

    const result = await acceptMatchRequest({
      supabase: auth.supabase,
      requestId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to accept match request.')
  }
})
