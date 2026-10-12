import type { FeatureConfig } from '../../config/types'
import type { StarterInitInputValues } from './types'

export interface StarterInitFiles {
  packageJson: string
  electronBuilderJson: string
  baseConfig: string
}

export interface StarterInitResult {
  packageJson: string
  electronBuilderJson: string
  baseConfig: string
}

interface PackageJsonShape {
  name: string
  productName?: string
  description?: string
  [key: string]: unknown
}

interface ElectronBuilderShape {
  appId: string
  [key: string]: unknown
}

export function applyStarterInit(
  files: StarterInitFiles,
  inputs: StarterInitInputValues,
  features: FeatureConfig,
): StarterInitResult {
  return {
    packageJson: updatePackageJson(files.packageJson, inputs),
    electronBuilderJson: updateElectronBuilderJson(files.electronBuilderJson, inputs),
    baseConfig: updateBaseConfig(files.baseConfig, inputs, features),
  }
}

export function updatePackageJson(
  packageJsonContent: string,
  inputs: StarterInitInputValues,
): string {
  const packageJson = JSON.parse(packageJsonContent) as PackageJsonShape

  packageJson.name = inputs.packageName
  packageJson.productName = inputs.displayName
  packageJson.description = `${inputs.displayName} desktop application.`

  return `${JSON.stringify(packageJson, null, 2)}\n`
}

export function updateElectronBuilderJson(
  electronBuilderJsonContent: string,
  inputs: StarterInitInputValues,
): string {
  const electronBuilderJson = JSON.parse(
    electronBuilderJsonContent,
  ) as ElectronBuilderShape

  electronBuilderJson.appId = inputs.appId

  return `${JSON.stringify(electronBuilderJson, null, 2)}\n`
}

export function updateBaseConfig(
  baseConfigContent: string,
  inputs: StarterInitInputValues,
  features: FeatureConfig,
): string {
  const nextAppConfig = {
    appName: inputs.appName,
    features,
  }

  let nextContent = replaceStringLiteral(baseConfigContent, 'appName', inputs.appName)
  nextContent = replaceObjectBooleanBlock(nextContent, 'features', features)
  nextContent = replaceBooleanLiteral(nextContent, 'update', 'enabled', features.autoUpdate)
  nextContent = replaceBooleanLiteral(nextContent, 'i18n', 'enabled', features.i18n)
  nextContent = replaceBooleanLiteral(
    nextContent,
    'appProtection',
    'enabled',
    features.appProtection,
  )
  nextContent = replaceBooleanLiteral(nextContent, 'licensing', 'enabled', features.licensing)
  nextContent = replaceBooleanLiteral(nextContent, 'database', 'enabled', features.database)
  nextContent = replaceBooleanLiteral(nextContent, 'logging', 'enabled', features.logging)

  assertStarterInitResult(nextContent, nextAppConfig)

  return nextContent
}

export function replaceStringLiteral(content: string, key: string, value: string): string {
  const nextContent = content.replace(
    new RegExp(`(${key}:\\s*)'[^']*'`),
    `$1'${escapeSingleQuotedString(value)}'`,
  )

  if (nextContent === content) {
    throw new Error(`Could not update "${key}" in base config.`)
  }

  return nextContent
}

export function replaceObjectBooleanBlock(
  content: string,
  objectKey: string,
  features: FeatureConfig,
): string {
  const blockPattern = createObjectBlockPattern(objectKey)
  const match = content.match(blockPattern)

  if (!match) {
    throw new Error(`Could not locate "${objectKey}" block in base config.`)
  }

  const indent = detectIndentation(match[2])
  const nextBlockBody = Object.entries(features)
    .map(([featureKey, enabled]) => `${indent}${featureKey}: ${String(enabled)},`)
    .join('\n')

  return content.replace(blockPattern, `$1\n${nextBlockBody}$3`)
}

export function replaceBooleanLiteral(
  content: string,
  objectKey: string,
  fieldKey: string,
  value: boolean,
): string {
  const blockPattern = createObjectBlockPattern(objectKey)
  const match = content.match(blockPattern)

  if (!match) {
    throw new Error(`Could not locate "${objectKey}" block in base config.`)
  }

  const nextBlockBody = match[2].replace(
    new RegExp(`(${fieldKey}:\\s*)(true|false)`),
    `$1${String(value)}`,
  )

  const nextContent = content.replace(blockPattern, `$1${nextBlockBody}$3`)

  return nextContent
}

export function createObjectBlockPattern(objectKey: string): RegExp {
  return new RegExp(`((?:^|\\n)\\s*${objectKey}:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`)
}

function detectIndentation(content: string): string {
  const match = content.match(/\n(\s+)[a-zA-Z]/)
  return match?.[1] ?? '    '
}

function escapeSingleQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function assertStarterInitResult(
  content: string,
  config: {
    appName: string
    features: FeatureConfig
  },
): void {
  const featureEntries = Object.entries(config.features ?? {})

  if (config.appName && !content.includes(`appName: '${escapeSingleQuotedString(config.appName)}'`)) {
    throw new Error('Base config app name update verification failed.')
  }

  for (const [featureKey, enabled] of featureEntries) {
    if (!content.includes(`${featureKey}: ${String(enabled)}`)) {
      throw new Error(`Base config feature verification failed for "${featureKey}".`)
    }
  }
}
