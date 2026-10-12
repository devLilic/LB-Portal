import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerI18nApi } from './i18nApi'

export function createI18nApiPreloadModule(): PreloadModule {
  return {
    id: 'i18n-api',
    register() {
      registerI18nApi()
    },
  }
}
