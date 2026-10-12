import { describe, expect, it } from 'vitest'

import {
  generateAppId,
  normalizeAppName,
  normalizeDisplayName,
  normalizePackageName,
  resolveStarterInitValues,
} from '../../../scripts/init/transform'
import {
  replaceBooleanLiteral,
  replaceStringLiteral,
} from '../../../scripts/init/applyStarterInit'

describe('starter init transform helpers', () => {
  it('normalizes display names into title-cased words', () => {
    expect(normalizeDisplayName('  acme_desktop-suite  ')).toBe('Acme Desktop Suite')
  })

  it('normalizes package names into npm-safe slugs', () => {
    expect(normalizePackageName('  @Acme/Desktop App  ')).toBe('@acme/desktop-app')
  })

  it('normalizes app names into config-safe slugs', () => {
    expect(normalizeAppName('@acme/desktop-app')).toBe('acme-desktop-app')
  })

  it('generates an app id from the package name when needed', () => {
    expect(generateAppId('@acme/desktop-app')).toBe('com.example.acme.desktopapp')
  })

  it('resolves derived init values from partial input', () => {
    expect(
      resolveStarterInitValues({
        appName: 'Acme Desktop App',
        packageName: '@Acme/Desktop App',
        initialEnabledModules: ['logging'],
      }),
    ).toEqual({
      appName: 'acme-desktop-app',
      appId: 'com.example.acme.desktopapp',
      packageName: '@acme/desktop-app',
      displayName: 'Acme Desktop App',
      initialEnabledModules: ['logging'],
    })
  })
})

describe('starter init placeholder helpers', () => {
  it('replaces single-quoted string literals in config content', () => {
    expect(replaceStringLiteral("appName: 'Electron Starter'", 'appName', 'Acme Desktop')).toBe(
      "appName: 'Acme Desktop'",
    )
  })

  it('replaces boolean literals inside a named config block', () => {
    const content = `update: {
  enabled: false,
  channel: 'latest',
}`

    expect(replaceBooleanLiteral(content, 'update', 'enabled', true)).toContain(
      'enabled: true',
    )
  })
})
