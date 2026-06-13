import { routeErrorJson, withAuthenticatedRoute } from '@/lib/server/auth'
import { getResultsMatches } from '@/lib/server/studentCommands'
import { toResultsResponseDto } from '@/contracts/readModels'
import { performanceJson } from '@/lib/server/performanceResponse'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  const startedAt = performance.now()
  try {
    const result = await getResultsMatches({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    return performanceJson(toResultsResponseDto(result), startedAt, 'results')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load results.')
  }
})
