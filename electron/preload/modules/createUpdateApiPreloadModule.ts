import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerUpdateApi } from './updateApi'

export function createUpdateApiPreloadModule(): PreloadModule {
  return {
    id: 'update-api',
    register() {
      registerUpdateApi()
    },
  }
}
