import { registerCoreIpc } from '../../ipc/registerCoreIpc'
import type { MainModule } from '../../../../src/shared/modules/contracts'

export function createCoreMainModule(): MainModule {
  return {
    id: 'core',
    register(context) {
      registerCoreIpc(context.config)
    },
  }
}
