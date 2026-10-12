import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerSettingsApi } from './settingsApi'

export function createSettingsApiPreloadModule(): PreloadModule {
  return {
    id: 'settings-api',
    register() {
      registerSettingsApi()
    },
  }
}
