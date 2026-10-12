import { app, ipcMain } from 'electron'
import type { AppConfig } from '../../../../config/types'
import { ipcInvokeChannels } from '../../../../src/shared/ipc/contracts'
import { createI18nResources } from '../../../../src/i18n/resources'
import { createSettingsStore } from '../settings/settingsStore'

let i18nHandlersRegistered = false

export function registerI18nModule(config: AppConfig) {
  if (i18nHandlersRegistered) {
    return
  }

  i18nHandlersRegistered = true

  const settingsStore = createSettingsStore(app.getPath('userData'))

  ipcMain.handle(ipcInvokeChannels.i18nGetCurrentLanguage, () => {
    return {
      language: settingsStore.getSetting('language') ?? config.i18n.defaultLanguage,
    }
  })

  ipcMain.handle(ipcInvokeChannels.i18nGetSupportedLanguages, () => {
    return {
      languages: config.i18n.supportedLanguages,
    }
  })

  ipcMain.handle(ipcInvokeChannels.i18nGetResources, (_event, payload) => {
    const resources = createI18nResources()
    const languageResources = resources[payload.language] ?? resources[config.i18n.defaultLanguage]
    const namespaces: Record<string, Record<string, string>> = {}

    return {
      language: payload.language,
      namespaces: payload.namespaces.reduce((accumulator: Record<string, Record<string, string>>, namespace: string) => {
        const namespaceValue = languageResources?.[namespace]

        if (namespaceValue && typeof namespaceValue === 'object') {
          accumulator[namespace] = namespaceValue as Record<string, string>
        }

        return accumulator
      }, namespaces),
    }
  })

  ipcMain.handle(ipcInvokeChannels.i18nSetLanguage, (_event, payload) => {
    return {
      language: settingsStore.setSetting('language', payload.language),
    }
  })
}
