export type PageAccess = 'public' | 'authenticated' | 'admin' | 'unclassified'

type RoutePolicy = {
  path: string
  access: Exclude<PageAccess, 'unclassified'>
  descendants?: boolean
}

const ROUTE_POLICIES: readonly RoutePolicy[] = [
  { path: '/', access: 'public' },
  { path: '/about', access: 'public' },
  { path: '/aspc-fees', access: 'public' },
  { path: '/aspc-info', access: 'public' },
  { path: '/aspc-policy', access: 'public' },
  { path: '/contact', access: 'public' },
  { path: '/faq', access: 'public' },
  { path: '/auth/callback', access: 'public' },
  { path: '/profile', access: 'authenticated' },
  { path: '/questionnaires', access: 'authenticated' },
  { path: '/matchForm', access: 'authenticated' },
  { path: '/editForm', access: 'authenticated', descendants: true },
  { path: '/results', access: 'authenticated' },
  { path: '/unmatched', access: 'authenticated' },
  { path: '/MatchRequestsPage', access: 'authenticated' },
  { path: '/aspc-delay', access: 'authenticated', descendants: true },
  { path: '/aspc-ready', access: 'authenticated' },
  { path: '/feedback', access: 'authenticated' },
  { path: '/admin', access: 'admin', descendants: true },
] as const

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === '/') return '/'
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

export const getPageAccess = (pathname: string): PageAccess => {
  const normalizedPathname = normalizePathname(pathname)
  const policy = ROUTE_POLICIES.find(({ path, descendants }) => {
    if (normalizedPathname === path) return true
    return descendants && normalizedPathname.startsWith(`${path}/`)
  })

  return policy?.access ?? 'unclassified'
}

export const getSafeReturnPath = (value: string | null | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('\\')) return null

  try {
    const baseUrl = new URL('https://pickup.invalid')
    const returnUrl = new URL(value, baseUrl)

    if (returnUrl.origin !== baseUrl.origin) return null

    return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`
  } catch {
    return null
  }
}

export const getSafeAuthOrigin = (
  requestUrl: URL,
  configuredCallbackUrl?: string,
) => {
  if (['localhost', '0.0.0.0', '127.0.0.1'].includes(requestUrl.hostname)) {
    return requestUrl.origin
  }

  if (configuredCallbackUrl) {
    try {
      return new URL(configuredCallbackUrl).origin
    } catch {
      // Fall back to the request URL when configuration is malformed.
    }
  }

  return requestUrl.origin
}
