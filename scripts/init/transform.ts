import type { StarterInitInputValues } from './types'

export interface StarterInitPartialInputValues {
  appName?: string
  appId?: string
  packageName?: string
  displayName?: string
  initialEnabledModules: StarterInitInputValues['initialEnabledModules']
}

export function normalizeDisplayName(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function normalizePackageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9@/_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/-/g, '/')
    .replace(/^-+|-+$/g, '')
}

export function normalizeAppName(value: string): string {
  return normalizePackageName(value).replace(/^@/, '').replace(/\//g, '-')
}

export function generateAppId(packageName: string): string {
  const normalizedPackageName = normalizePackageName(packageName)
    .replace(/^@/, '')
    .replace(/\//g, '.')
    .replace(/-/g, '')

  return `com.example.${normalizedPackageName}`
}

export function resolveStarterInitValues(
  inputs: StarterInitPartialInputValues,
): StarterInitInputValues {
  const displayName = normalizeDisplayName(
    inputs.displayName ?? inputs.appName ?? inputs.packageName ?? 'Electron Starter',
  )
  const packageName = normalizePackageName(
    inputs.packageName ?? inputs.appName ?? displayName,
  )
  const appName = normalizeAppName(inputs.appName ?? packageName)
  const appId = (inputs.appId?.trim() || generateAppId(packageName)).toLowerCase()

  return {
    appName,
    appId,
    packageName,
    displayName,
    initialEnabledModules: inputs.initialEnabledModules,
  }
}
