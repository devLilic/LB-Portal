import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerDatabaseModule } from './index'

export function createDatabaseMainModule(): MainModule {
  return {
    id: 'database',
    isEnabled(config) {
      return config.features.database && config.database.enabled
    },
    async register(context) {
      await registerDatabaseModule(context.config)
    },
  }
}
