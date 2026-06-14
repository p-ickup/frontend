/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const projectRoot = process.cwd()

const collectProductionSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectProductionSourceFiles(entryPath)
    if (!/\.tsx?$/.test(entry.name)) return []
    if (/\.(?:test|spec)\.tsx?$/.test(entry.name)) return []
    if (entry.name.endsWith('.d.ts')) return []
    if (entryPath.endsWith(path.join('src', 'lib', 'database.types.ts'))) {
      return []
    }
    return [path.relative(projectRoot, entryPath)]
  })

const productionSourceFiles = collectProductionSourceFiles(
  path.join(projectRoot, 'src'),
)

const readSourceFile = (relativePath: string) => {
  const absolutePath = path.join(projectRoot, relativePath)
  const sourceText = fs.readFileSync(absolutePath, 'utf8')
  return ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
}

const getPropertyName = (name: ts.PropertyName | undefined) => {
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return null
}

const getObjectProperty = (
  object: ts.ObjectLiteralExpression,
  propertyName: string,
) =>
  object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      getPropertyName(property.name) === propertyName,
  )

const getObjectKeys = (object: ts.ObjectLiteralExpression) =>
  object.properties
    .map((property) => getPropertyName(property.name))
    .filter((name): name is string => Boolean(name))
    .sort()

const collectApplicationRpcContract = () => {
  const rpcContract = new Map<string, string[]>()

  for (const relativePath of productionSourceFiles) {
    const sourceFile = readSourceFile(relativePath)

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'rpc'
        ) {
          const rpcName = node.arguments[0]
          const params = node.arguments[1]
          if (
            rpcName &&
            ts.isStringLiteral(rpcName) &&
            params &&
            ts.isObjectLiteralExpression(params)
          ) {
            rpcContract.set(rpcName.text, getObjectKeys(params))
          }
        }

        if (
          ts.isIdentifier(node.expression) &&
          ['runAdminGroupsRpc', 'runDelayRpc'].includes(node.expression.text)
        ) {
          const options = node.arguments[0]
          if (options && ts.isObjectLiteralExpression(options)) {
            const nameProperty = getObjectProperty(options, 'name')
            const paramsProperty = getObjectProperty(options, 'params')
            if (
              nameProperty &&
              ts.isStringLiteral(nameProperty.initializer) &&
              paramsProperty &&
              ts.isObjectLiteralExpression(paramsProperty.initializer)
            ) {
              rpcContract.set(
                nameProperty.initializer.text,
                getObjectKeys(paramsProperty.initializer),
              )
            }
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return new Map(
    [...rpcContract.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
}

const collectApplicationTableContract = () => {
  const tableNames = new Set<string>()

  for (const relativePath of productionSourceFiles) {
    const sourceFile = readSourceFile(relativePath)

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'from'
      ) {
        const receiver = node.expression.expression.getText(sourceFile)
        const tableName = node.arguments[0]

        if (
          receiver !== 'Array' &&
          !receiver.endsWith('.storage') &&
          tableName &&
          ts.isStringLiteral(tableName)
        ) {
          tableNames.add(tableName.text)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return [...tableNames].sort((left, right) => left.localeCompare(right))
}

const collectGeneratedRpcContract = () => {
  const sourceFile = readSourceFile('src/lib/database.types.ts')
  const rpcContract = new Map<string, string[]>()

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertySignature(node) &&
      getPropertyName(node.name) === 'Functions' &&
      node.type &&
      ts.isTypeLiteralNode(node.type)
    ) {
      for (const member of node.type.members) {
        if (
          ts.isPropertySignature(member) &&
          member.type &&
          ts.isTypeLiteralNode(member.type)
        ) {
          const rpcName = getPropertyName(member.name)
          const argsProperty = member.type.members.find(
            (property): property is ts.PropertySignature =>
              ts.isPropertySignature(property) &&
              getPropertyName(property.name) === 'Args',
          )
          if (
            rpcName &&
            argsProperty?.type &&
            ts.isTypeLiteralNode(argsProperty.type)
          ) {
            rpcContract.set(
              rpcName,
              argsProperty.type.members
                .map((argument) =>
                  ts.isPropertySignature(argument)
                    ? getPropertyName(argument.name)
                    : null,
                )
                .filter((name): name is string => Boolean(name))
                .sort(),
            )
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return rpcContract
}

const collectGeneratedTableContract = () => {
  const sourceFile = readSourceFile('src/lib/database.types.ts')
  const tableNames = new Set<string>()

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertySignature(node) &&
      getPropertyName(node.name) === 'Tables' &&
      node.type &&
      ts.isTypeLiteralNode(node.type)
    ) {
      for (const member of node.type.members) {
        if (ts.isPropertySignature(member)) {
          const tableName = getPropertyName(member.name)
          if (tableName) tableNames.add(tableName)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return tableNames
}

describe('generated database contract', () => {
  it('declares every public table referenced by production code', () => {
    const applicationTableNames = collectApplicationTableContract()
    const generatedTableNames = collectGeneratedTableContract()
    const missingTableNames = applicationTableNames.filter(
      (name) => !generatedTableNames.has(name),
    )

    expect(applicationTableNames).toEqual([
      'AlgorithmStatus',
      'ChangeLog',
      'Comments',
      'Feedback',
      'Flights',
      'legal_acceptances',
      'match_cancellations',
      'Matches',
      'MatchRequests',
      'Users',
    ])
    expect(missingTableNames).toEqual([])
  })

  it('declares every production RPC and its application argument names', () => {
    const applicationContract = collectApplicationRpcContract()
    const generatedContract = collectGeneratedRpcContract()
    const applicationRpcNames = [...applicationContract.keys()]
    const missingRpcNames = applicationRpcNames.filter(
      (name) => !generatedContract.has(name),
    )
    const argumentMismatches = applicationRpcNames.flatMap((name) => {
      const applicationArguments = applicationContract.get(name) || []
      const generatedArguments = generatedContract.get(name) || []
      return applicationArguments.join(',') === generatedArguments.join(',')
        ? []
        : [{ name, applicationArguments, generatedArguments }]
    })

    expect(applicationRpcNames).toEqual([
      'accept_match_request',
      'aspc_delay_create_solo_ride',
      'aspc_delay_decline_groups',
      'aspc_delay_join_group',
      'aspc_delay_keep_original_group',
      'aspc_delay_move_to_unmatched',
      'cancel_own_match',
      'create_group_records',
      'delete_group_records',
      'delete_own_flight_tx',
      'report_ready_status',
      'update_own_flight_tx',
    ])
    expect(missingRpcNames).toEqual([])
    expect(argumentMismatches).toEqual([])
  })
})
