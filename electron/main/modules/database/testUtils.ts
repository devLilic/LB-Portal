import { loadConfig } from '../../../../config/loadConfig'
import { createDatabaseConnection } from './connection'
import type { DatabaseConnection } from './types'

export async function createInMemoryDatabaseConnection(
  env: Record<string, string | undefined> = {},
): Promise<DatabaseConnection> {
  const config = loadConfig('production', {
    APP_FEATURE_DATABASE: 'true',
    APP_DATABASE_ENABLED: 'true',
    APP_DATABASE_IN_MEMORY_FOR_TESTS: 'true',
    ...env,
  })

  return createDatabaseConnection(config, '')
}
