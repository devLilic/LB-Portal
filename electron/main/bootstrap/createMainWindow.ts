import { indexHtmlPath, VITE_DEV_SERVER_URL } from './paths'
import { applyRuntimeSecurityPolicies } from '../security/runtimeSecurity'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { ipcEventChannels } from '../../../src/shared/ipc/contracts'
import { app, dialog } from 'electron'
import type { AppConfig } from '../../../config/types'
import { createSettingsStore } from '../modules/settings/settingsStore'
import roSettings from '../../../src/i18n/locales/ro/settings.json'
import enSettings from '../../../src/i18n/locales/en/settings.json'
import ruSettings from '../../../src/i18n/locales/ru/settings.json'

export async function createMainWindow(config: AppConfig) {
  const window = createSecureBrowserWindow({
    title: 'LB-Portal',
    webPreferences: { devTools: false },
  })
  window.maximize()

  window.webContents.on('will-prevent-unload', (event) => {
    const language = config.features.i18n && config.i18n.enabled
      ? createSettingsStore(app.getPath('userData')).getSetting('language') ?? config.i18n.defaultLanguage
      : config.i18n.defaultLanguage
    const messages = { ro: roSettings, en: enSettings, ru: ruSettings }[language].mos
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: messages.leaveTitle,
      message: messages.leaveBody,
      buttons: [messages.keepEditing, messages.discard],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    if (choice === 1) event.preventDefault()
  })

  if (VITE_DEV_SERVER_URL) {
    await window.loadURL(VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(indexHtmlPath)
  }

  window.webContents.on('did-finish-load', () => {
    window.webContents.send(ipcEventChannels.appMainProcessMessage, new Date().toLocaleString())
  })

  applyRuntimeSecurityPolicies(window)

  return window
}
