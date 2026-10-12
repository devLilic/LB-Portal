import type { AppConfig } from '../../../../config/types'
import { app } from 'electron'
import { createDatabaseLogger, createLogger } from '../../logging'
import { registerDatabaseIpc } from './ipc'
import { createDatabaseConnection } from './connection'
import { createAppMetadataRepository } from './repositories'
import { createAppMetadataService } from './services'
import type { DatabaseModuleState } from './types'

export async function registerDatabaseModule(config: AppConfig): Promise<DatabaseModuleState> {
  const databaseLogger = createDatabaseLogger(createLogger({ logging: config.logging }, 'database'))
  registerDatabaseIpc(config)
  const connection = await createDatabaseConnection(config, app.getPath('userData'))
  databaseLogger.connectionOpened({
    filePath: connection.plan.filePath,
    inMemory: connection.plan.inMemory,
  })

  createAppMetadataService(createAppMetadataRepository(connection))
  databaseLogger.repositoryReady('appMetadata')

  return {
    connection,
  }
}

export * from './testUtils'
