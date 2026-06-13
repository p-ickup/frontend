import { getUnmatchedOptions } from '@/lib/server/studentCommands'
import { routeErrorJson, withAuthenticatedRoute } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { toUnmatchedOptionsResponseDto } from '@/contracts/readModels'
import { performanceJson } from '@/lib/server/performanceResponse'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  const startedAt = performance.now()
  try {
    const result = await getUnmatchedOptions({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
    })

    return performanceJson(
      toUnmatchedOptionsResponseDto(result),
      startedAt,
      'unmatched_options',
    )
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load unmatched options.')
  }
})
