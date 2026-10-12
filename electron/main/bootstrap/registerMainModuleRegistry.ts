import type { AppConfig } from '../../../config/types'
import type { BrowserWindow } from 'electron'
import { registerMainModules } from '../../../src/shared/modules/registry'
import { createAutoUpdateMainModule } from '../modules/auto-update/createAutoUpdateMainModule'
import { createCoreMainModule } from '../modules/core/createCoreMainModule'
import { createDatabaseMainModule } from '../modules/database/createDatabaseMainModule'
import { createI18nMainModule } from '../modules/i18n/createI18nMainModule'
import { createLicensingMainModule } from '../modules/licensing/createLicensingMainModule'
import { createSettingsMainModule } from '../modules/settings/createSettingsMainModule'

export function registerMainModuleRegistry(
  config: AppConfig,
  getMainWindow: () => BrowserWindow | null,
) {
  return registerMainModules(
    [
      createCoreMainModule(),
      createSettingsMainModule(),
      createDatabaseMainModule(),
      createI18nMainModule(),
      createLicensingMainModule(),
      createAutoUpdateMainModule(),
    ],
    {
      config,
      getMainWindow,
    },
  )
}
