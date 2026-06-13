import { routeErrorJson, withAuthenticatedRoute } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { listIncomingMatchRequests } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  try {
    const result = await listIncomingMatchRequests({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load incoming match requests.')
  }
})
