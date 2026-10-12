import type { MainModule } from '../../../../src/shared/modules/contracts'
import { isAutoUpdateEnabled } from '../../../../src/shared/auto-update/activation'
import { registerAutoUpdateModule } from './registerAutoUpdateModule'

export function createAutoUpdateMainModule(): MainModule {
  return {
    id: 'auto-update',
    isEnabled(config) {
      return isAutoUpdateEnabled(config)
    },
    register(context) {
      registerAutoUpdateModule(context.getMainWindow, context.config)
    },
  }
}
