import { routeErrorJson, withAuthenticatedRoute } from '@/lib/server/auth'
import { getResultsMatches } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'
import { toResultsResponseDto } from '@/contracts/readModels'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  try {
    const result = await getResultsMatches({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    return NextResponse.json(toResultsResponseDto(result))
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load results.')
  }
})
