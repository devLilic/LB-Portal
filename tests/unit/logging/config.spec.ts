import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'

describe('logging config', () => {
  it('uses the development logging defaults', () => {
    const config = loadConfig('development', {})

    expect(config.features.logging).toBe(true)
    expect(config.logging.enabled).toBe(true)
    expect(config.logging.level).toBe('debug')
  })

  it('resolves explicit logging env overrides', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LOGGING: 'false',
      APP_LOGGING_ENABLED: 'true',
      APP_LOG_LEVEL: 'error',
    })

    expect(config.features.logging).toBe(true)
    expect(config.logging.enabled).toBe(true)
    expect(config.logging.level).toBe('error')
  })

  it('disables logging when the nested config is false', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LOGGING: 'true',
      APP_LOGGING_ENABLED: 'false',
      APP_LOG_LEVEL: 'debug',
    })

    expect(config.features.logging).toBe(false)
    expect(config.logging.enabled).toBe(false)
    expect(config.logging.level).toBe('debug')
  })
})
