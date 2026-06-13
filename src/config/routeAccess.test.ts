/** @jest-environment node */

import {
  getPageAccess,
  getSafeAuthOrigin,
  getSafeReturnPath,
} from '@/config/routeAccess'
import { config } from '@/middleware'
import { readdirSync } from 'fs'
import path from 'path'

const collectPageRoutes = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectPageRoutes(entryPath)
    if (entry.name !== 'page.tsx') return []

    const relativePath = path.relative(
      path.join(process.cwd(), 'src/app'),
      entryPath,
    )
    const routePath =
      relativePath === 'page.tsx'
        ? ''
        : relativePath.replace(/\/page\.tsx$/, '').replaceAll(path.sep, '/')
    const representativePath = routePath.replace(/\[[^/]+\]/g, '__dynamic__')
    return [representativePath ? `/${representativePath}` : '/']
  })

const matchesMiddleware = (pathname: string) =>
  config.matcher.some((matcher) => {
    if (!matcher.endsWith('/:path*')) return pathname === matcher

    const basePath = matcher.slice(0, -'/:path*'.length)
    return pathname === basePath || pathname.startsWith(`${basePath}/`)
  })

describe('route access policy', () => {
  it.each([
    '/',
    '/about',
    '/aspc-fees',
    '/aspc-info',
    '/aspc-policy',
    '/contact',
    '/faq',
    '/auth/callback',
  ])('classifies %s as public', (pathname) => {
    expect(getPageAccess(pathname)).toBe('public')
  })

  it.each([
    '/profile',
    '/questionnaires',
    '/matchForm',
    '/editForm/42',
    '/results',
    '/unmatched',
    '/MatchRequestsPage',
    '/aspc-delay',
    '/aspc-delay/42',
    '/aspc-ready',
    '/feedback',
  ])('classifies %s as authenticated', (pathname) => {
    expect(getPageAccess(pathname)).toBe('authenticated')
  })

  it.each(['/admin', '/admin/groups'])('classifies %s as admin', (pathname) => {
    expect(getPageAccess(pathname)).toBe('admin')
  })

  it('leaves unknown routes unclassified', () => {
    expect(getPageAccess('/new-unreviewed-route')).toBe('unclassified')
  })

  it('classifies every page in the application', () => {
    const pageRoutes = collectPageRoutes(path.join(process.cwd(), 'src/app'))
    const unclassifiedRoutes = pageRoutes.filter(
      (pathname) => getPageAccess(pathname) === 'unclassified',
    )

    expect(unclassifiedRoutes).toEqual([])
  })

  it('keeps middleware coverage synchronized with every page policy', () => {
    const pageRoutes = collectPageRoutes(path.join(process.cwd(), 'src/app'))

    for (const pathname of pageRoutes) {
      const access = getPageAccess(pathname)
      expect(matchesMiddleware(pathname)).toBe(access !== 'public')
    }
  })
})

describe('safe return paths', () => {
  it.each([
    ['/results', '/results'],
    ['/aspc-ready?ride_id=42', '/aspc-ready?ride_id=42'],
    ['/editForm/7#details', '/editForm/7#details'],
  ])('accepts same-origin path %s', (value, expected) => {
    expect(getSafeReturnPath(value)).toBe(expected)
  })

  it.each([
    'https://attacker.example',
    'http://attacker.example',
    '//attacker.example/path',
    '///attacker.example/path',
    '/\\attacker.example/path',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'results',
    '',
  ])('rejects unsafe return path %s', (value) => {
    expect(getSafeReturnPath(value)).toBeNull()
  })

  it('rejects absent return paths', () => {
    expect(getSafeReturnPath(null)).toBeNull()
    expect(getSafeReturnPath(undefined)).toBeNull()
  })
})

describe('safe authentication origins', () => {
  it('uses the configured callback origin in production', () => {
    expect(
      getSafeAuthOrigin(
        new URL('https://forwarded-attacker.example/auth/callback'),
        'https://pickup.example/auth/callback',
      ),
    ).toBe('https://pickup.example')
  })

  it('preserves the initiating local origin for PKCE development flows', () => {
    expect(
      getSafeAuthOrigin(
        new URL('http://localhost:3100/auth/callback'),
        'https://pickup.example/auth/callback',
      ),
    ).toBe('http://localhost:3100')
  })

  it('falls back to the request origin when callback configuration is invalid', () => {
    expect(
      getSafeAuthOrigin(
        new URL('https://pickup.example/auth/callback'),
        'not a URL',
      ),
    ).toBe('https://pickup.example')
  })
})
