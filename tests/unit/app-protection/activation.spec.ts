import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { bootstrapAppProtection } from '../../../electron/main/security/appProtection'
import { isAppProtectionEnabled } from '../../../src/shared/app-protection/activation'

describe('app protection activation', () => {
  it('stays disabled in development even when the feature flag is enabled', () => {
    const config = loadConfig('development', {
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_APP_PROTECTION_ENABLED: 'true',
    })

    expect(isAppProtectionEnabled(config)).toBe(false)
  })

  it('stays disabled in production when the feature flag is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_APP_PROTECTION: 'false',
      APP_APP_PROTECTION_ENABLED: 'true',
    })

    expect(isAppProtectionEnabled(config)).toBe(false)
  })

  it('activates in production when the feature flag and nested config are enabled', () => {
    const config = loadConfig('production', {
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_APP_PROTECTION_ENABLED: 'true',
      APP_APP_PROTECTION_PROFILE: 'commercial',
    })

    expect(isAppProtectionEnabled(config)).toBe(true)
  })

  it('resolves an inactive standard policy in development', () => {
    const config = loadConfig('development', {
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_APP_PROTECTION_ENABLED: 'true',
      APP_APP_PROTECTION_PROFILE: 'commercial',
    })

    expect(bootstrapAppProtection(config)).toEqual({
      active: false,
      profile: 'commercial',
    })
  })

  it('resolves the configured commercial profile in production when enabled', () => {
    const config = loadConfig('production', {
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_APP_PROTECTION_ENABLED: 'true',
      APP_APP_PROTECTION_PROFILE: 'commercial',
    })

    expect(bootstrapAppProtection(config)).toEqual({
      active: true,
      profile: 'commercial',
    })
  })

  it('falls back to an inactive standard policy when the production feature flag is disabled', () => {
    const config = loadConfig('production', {
      APP_FEATURE_APP_PROTECTION: 'false',
      APP_APP_PROTECTION_ENABLED: 'true',
      APP_APP_PROTECTION_PROFILE: 'standard',
    })

    expect(bootstrapAppProtection(config)).toEqual({
      active: false,
      profile: 'standard',
    })
  })
})
