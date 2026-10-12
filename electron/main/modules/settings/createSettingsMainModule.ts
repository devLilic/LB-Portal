import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerSettingsModule } from './registerSettingsModule'

export function createSettingsMainModule(): MainModule {
  return {
    id: 'settings',
    register() {
      registerSettingsModule()
    },
  }
}
