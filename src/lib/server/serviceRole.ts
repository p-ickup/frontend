import 'server-only'

import { createClient } from '@supabase/supabase-js'

let serviceRoleClient: any = null

export const createServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase secret key credentials are not configured.')
  }

  if (!serviceRoleClient) {
    serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return serviceRoleClient
}
