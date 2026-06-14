import {
  createBrowserClient as browserClient,
  createServerClient as serverClient,
} from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/** One browser client avoids multiple GoTrueClient instances sharing the same storage key. */
let browserClientSingleton: any = null

export const createBrowserClient = () => {
  if (typeof window === 'undefined') {
    return browserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  if (!browserClientSingleton) {
    browserClientSingleton = browserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClientSingleton
}

export const createServerClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) =>
  serverClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch (error) {
            // Server Components cannot write cookies; middleware refreshes them.
          }
        },
      },
    },
  )

export const createMiddlewareClient = (request: NextRequest) => {
  // Create an unmodified response
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = serverClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  return {
    supabase,
    getResponse: () => response,
  }
}
