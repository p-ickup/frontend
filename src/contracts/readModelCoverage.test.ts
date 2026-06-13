/** @jest-environment node */

import fs from 'fs'
import path from 'path'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const collectProductionSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectProductionSourceFiles(entryPath)
    if (
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      /\.test\.(?:ts|tsx)$/.test(entry.name)
    ) {
      return []
    }
    return [entryPath]
  })

describe('read-model query coverage', () => {
  it('contains no broad select query in production TypeScript', () => {
    const violations = collectProductionSourceFiles(
      path.join(process.cwd(), 'src'),
    )
      .filter((sourcePath) => {
        const source = fs.readFileSync(sourcePath, 'utf8')
        return (
          /\.select\(\s*['"`]\s*\*/.test(source) ||
          /\.select\(\s*\)/.test(source)
        )
      })
      .map((sourcePath) => path.relative(process.cwd(), sourcePath))

    expect(violations).toEqual([])
  })

  it('serializes key API responses through explicit contracts', () => {
    expect(readSource('src/app/api/results/route.ts')).toContain(
      'toResultsResponseDto(result)',
    )
    expect(readSource('src/app/api/unmatched/options/route.ts')).toContain(
      'toUnmatchedOptionsResponseDto(result)',
    )
    expect(
      readSource('src/app/api/admin/dashboard-summary/route.ts'),
    ).toContain('getAdminDashboardSummary({')

    const groupsSnapshotRoute = readSource(
      'src/app/api/admin/groups/snapshot/route.ts',
    )
    expect(groupsSnapshotRoute).toContain('withAdminRoute')
    expect(groupsSnapshotRoute).toContain('fetchGroupsManagementSnapshot({')
    expect(groupsSnapshotRoute).toContain('Promise.all([')
  })
})
