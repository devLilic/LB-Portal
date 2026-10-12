import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '../../../../config/types'
import type { DatabaseConnection, DatabaseConnectionPlan } from './types'
import { databaseSchema } from './schema'

export function createDatabaseConnectionPlan(
  config: AppConfig,
  storageDir: string,
): DatabaseConnectionPlan {
  const inMemory = config.database.inMemoryForTests
  const filePath = inMemory ? ':memory:' : path.join(storageDir, config.database.fileName)

  return {
    kind: 'sqlite',
    provider: 'sqlite',
    orm: 'drizzle',
    fileName: config.database.fileName,
    filePath,
    inMemory,
  }
}

export async function createDatabaseConnection(
  config: AppConfig,
  storageDir: string,
): Promise<DatabaseConnection> {
  const plan = createDatabaseConnectionPlan(config, storageDir)

  if (!plan.inMemory) {
    mkdirSync(path.dirname(plan.filePath), { recursive: true })
  }

  const [{ default: Database }, { drizzle }] = await Promise.all([
    import('better-sqlite3'),
    import('drizzle-orm/better-sqlite3'),
  ])

  const client = new Database(plan.filePath)
  const db = drizzle(client, {
    schema: databaseSchema,
  })

  return {
    plan,
    client,
    db,
    close() {
      client.close()
    },
  }
}
