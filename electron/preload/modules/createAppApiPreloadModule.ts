import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerAppApi } from './appApi'

export function createAppApiPreloadModule(): PreloadModule {
  return {
    id: 'app-api',
    register(context) {
      registerAppApi(context.config)
    },
  }
}
