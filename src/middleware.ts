import { getPageAccess } from '@/config/routeAccess'
import { createMiddlewareClient } from '@/utils/supabase'
import { NextResponse, type NextRequest } from 'next/server'

const copyResponseCookies = (
  source: NextResponse,
  destination: NextResponse,
) => {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie))
}

export async function middleware(request: NextRequest) {
  const access = getPageAccess(request.nextUrl.pathname)
  if (access === 'public' || access === 'unclassified') {
    return NextResponse.next()
  }

  const middlewareClient = createMiddlewareClient(request)
  const {
    data: { user },
  } = await middlewareClient.supabase.auth.getUser()
  const response = middlewareClient.getResponse()

  if (!user) {
    const signInUrl = request.nextUrl.clone()
    const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

    signInUrl.pathname = '/'
    signInUrl.search = ''
    signInUrl.searchParams.set('redirectTo', returnPath)

    const redirectResponse = NextResponse.redirect(signInUrl)
    copyResponseCookies(response, redirectResponse)
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    '/profile',
    '/questionnaires',
    '/matchForm',
    '/editForm/:path*',
    '/results',
    '/unmatched',
    '/MatchRequestsPage',
    '/aspc-delay/:path*',
    '/aspc-ready',
    '/feedback',
    '/admin/:path*',
  ],
}
