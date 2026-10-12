import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerDatabaseApi } from './databaseApi'

export function createDatabaseApiPreloadModule(): PreloadModule {
  return {
    id: 'database-api',
    register() {
      registerDatabaseApi()
    },
  }
}
