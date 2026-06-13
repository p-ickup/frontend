import { getUnmatchedOptions } from '@/lib/server/studentCommands'
import { routeErrorJson, withAuthenticatedRoute } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { NextResponse } from 'next/server'
import { toUnmatchedOptionsResponseDto } from '@/contracts/readModels'

export const GET = withAuthenticatedRoute(async (_request, auth) => {
  try {
    const result = await getUnmatchedOptions({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
    })

    return NextResponse.json(toUnmatchedOptionsResponseDto(result))
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load unmatched options.')
  }
})
