import type { AppConfig } from '../../../../config/types'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { Database } from 'better-sqlite3'
import type { databaseSchema } from './schema'

export interface DatabaseModuleContext {
  config: AppConfig
}

export interface DatabaseConnectionPlan {
  kind: 'sqlite'
  provider: 'sqlite'
  orm: 'drizzle'
  fileName: string
  filePath: string
  inMemory: boolean
}

export interface DatabaseConnection {
  plan: DatabaseConnectionPlan
  client: Database
  db: BetterSQLite3Database<typeof databaseSchema> & {
    $client: Database
  }
  close: () => void
}

export interface DatabaseModuleState {
  connection: DatabaseConnection | null
}
