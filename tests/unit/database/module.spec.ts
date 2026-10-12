import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { createDatabaseMainModule } from '../../../electron/main/modules/database/createDatabaseMainModule'

describe('database module gating', () => {
  it('stays disabled when the database feature flag is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_DATABASE: 'false',
      APP_DATABASE_ENABLED: 'true',
    })

    expect(createDatabaseMainModule().isEnabled?.(config)).toBe(false)
  })

  it('stays disabled when the database config is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_DATABASE: 'true',
      APP_DATABASE_ENABLED: 'false',
    })

    expect(createDatabaseMainModule().isEnabled?.(config)).toBe(false)
  })

  it('is enabled when the database feature flag and config are on', () => {
    const config = loadConfig('production', {
      APP_FEATURE_DATABASE: 'true',
      APP_DATABASE_ENABLED: 'true',
    })

    expect(createDatabaseMainModule().isEnabled?.(config)).toBe(true)
  })
})
