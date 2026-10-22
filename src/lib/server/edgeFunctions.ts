import 'server-only'

import { FunctionsHttpError } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/server/serviceRole'

/**
 * Invokes an internal edge function with the service role key and relays its JSON response.
 * The edge functions reject the public anon key, so callers must authorize the user first.
 */
export async function relayEdgeFunction(name: string, body: unknown) {
  const { data, error } = await createServiceRoleClient().functions.invoke(
    name,
    { body },
  )

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    const result = await response.json().catch(() => ({}))
    return NextResponse.json(
      { error: result.error || `HTTP ${response.status}` },
      { status: response.status },
    )
  }
  if (error) throw error

  return NextResponse.json(data)
}
