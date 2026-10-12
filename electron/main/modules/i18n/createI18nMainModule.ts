import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerI18nModule } from './registerI18nModule'

export function createI18nMainModule(): MainModule {
  return {
    id: 'i18n',
    register(context) {
      registerI18nModule(context.config)
    },
  }
}
