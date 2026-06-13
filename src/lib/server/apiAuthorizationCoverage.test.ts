/** @jest-environment node */

import { readdirSync, readFileSync } from 'fs'
import path from 'path'

const HTTP_METHODS = 'GET|POST|PUT|PATCH|DELETE'

const collectRouteFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectRouteFiles(entryPath)
    return entry.name === 'route.ts' ? [entryPath] : []
  })

describe('API authorization coverage', () => {
  const apiDirectory = path.join(process.cwd(), 'src/app/api')

  it('exports every API method through the required authorization wrapper', () => {
    const violations: string[] = []

    for (const routeFile of collectRouteFiles(apiDirectory)) {
      const source = readFileSync(routeFile, 'utf8')
      const relativePath = path.relative(process.cwd(), routeFile)
      const exportedMethods = Array.from(
        source.matchAll(
          new RegExp(`export (?:async function|const) (${HTTP_METHODS})`, 'g'),
        ),
        (match) => match[1],
      )
      const expectedWrapper = relativePath.includes('/api/admin/')
        ? 'withAdminRoute'
        : 'withAuthenticatedRoute'

      for (const method of exportedMethods) {
        const wrappedExport = new RegExp(
          `export const ${method}\\s*=\\s*${expectedWrapper}\\(`,
        )
        if (!wrappedExport.test(source)) {
          violations.push(
            `${relativePath}: ${method} must use ${expectedWrapper}`,
          )
        }
      }

      if (exportedMethods.length === 0) {
        violations.push(`${relativePath}: no recognized HTTP method export`)
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps manual route guard calls out of API handlers', () => {
    const violations = collectRouteFiles(apiDirectory)
      .filter((routeFile) =>
        /require(?:Authenticated|Admin)Route\s*\(/.test(
          readFileSync(routeFile, 'utf8'),
        ),
      )
      .map((routeFile) => path.relative(process.cwd(), routeFile))

    expect(violations).toEqual([])
  })
})
