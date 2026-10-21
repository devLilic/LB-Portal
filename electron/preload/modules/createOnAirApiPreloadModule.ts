import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerOnAirApi } from './onAirApi'

export function createOnAirApiPreloadModule(): PreloadModule {
  return {
    id: 'onair-api',
    register() {
      registerOnAirApi()
    },
  }
}
