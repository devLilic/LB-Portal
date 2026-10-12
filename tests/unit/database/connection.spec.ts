import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import {
  createDatabaseConnectionPlan,
} from '../../../electron/main/modules/database/connection'
import { createInMemoryDatabaseConnection } from '../../../electron/main/modules/database'

describe('database connection plan', () => {
  it('resolves a file-backed sqlite plan by default', () => {
    const config = loadConfig('production', {
      APP_FEATURE_DATABASE: 'true',
      APP_DATABASE_ENABLED: 'true',
      APP_DATABASE_FILE_NAME: 'starter.sqlite',
    })

    expect(createDatabaseConnectionPlan(config, 'D:\\temp\\starter')).toEqual({
      kind: 'sqlite',
      provider: 'sqlite',
      orm: 'drizzle',
      fileName: 'starter.sqlite',
      filePath: path.join('D:\\temp\\starter', 'starter.sqlite'),
      inMemory: false,
    })
  })

  it('resolves an in-memory sqlite plan for tests when configured', () => {
    const config = loadConfig('production', {
      APP_FEATURE_DATABASE: 'true',
      APP_DATABASE_ENABLED: 'true',
      APP_DATABASE_IN_MEMORY_FOR_TESTS: 'true',
    })

    expect(createDatabaseConnectionPlan(config, 'D:\\temp\\starter')).toEqual({
      kind: 'sqlite',
      provider: 'sqlite',
      orm: 'drizzle',
      fileName: 'app.db',
      filePath: ':memory:',
      inMemory: true,
    })
  })

  it('creates an in-memory helper connection for tests without a file dependency', async () => {
    const connection = await createInMemoryDatabaseConnection()

    expect(connection.plan.filePath).toBe(':memory:')
    expect(connection.plan.inMemory).toBe(true)

    connection.close()
  })
})
