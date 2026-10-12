import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerLicensingModule } from './registerLicensingModule'

export function createLicensingMainModule(): MainModule {
  return {
    id: 'licensing',
    register(context) {
      registerLicensingModule(context.config)
    },
  }
}
