import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { isAutoUpdateEnabled } from '../../../src/shared/auto-update/activation'

describe('auto update activation', () => {
  it('is disabled in development even when the feature flag is enabled', () => {
    const config = loadConfig('development', {
      APP_FEATURE_AUTO_UPDATE: 'true',
    })

    expect(isAutoUpdateEnabled(config)).toBe(false)
  })

  it('is disabled in production when the feature flag is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_AUTO_UPDATE: 'false',
    })

    expect(isAutoUpdateEnabled(config)).toBe(false)
  })

  it('is enabled in production when the feature flag is on', () => {
    const config = loadConfig('production', {
      APP_FEATURE_AUTO_UPDATE: 'true',
    })

    expect(isAutoUpdateEnabled(config)).toBe(true)
  })
})
