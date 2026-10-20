import { indexHtmlPath, VITE_DEV_SERVER_URL } from './paths'
import { applyRuntimeSecurityPolicies } from '../security/runtimeSecurity'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { ipcEventChannels } from '../../../src/shared/ipc/contracts'
import { app, dialog } from 'electron'
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '../../../config/types'
import { createSettingsStore } from '../modules/settings/settingsStore'
import roSettings from '../../../src/i18n/locales/ro/settings.json'
import enSettings from '../../../src/i18n/locales/en/settings.json'
import ruSettings from '../../../src/i18n/locales/ru/settings.json'

export async function createMainWindow(config: AppConfig) {
  const window = createSecureBrowserWindow({
    title: 'LB-Portal',
    backgroundColor: '#070d16',
    webPreferences: { devTools: false },
  })
  window.maximize()

  window.webContents.on('render-process-gone', (_event, details) => {
    writeRendererDiagnostic({
      event: 'render-process-gone',
      reason: details.reason,
      exitCode: details.exitCode,
    })
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    writeRendererDiagnostic({
      event: 'preload-error',
      preloadPath,
      error: error.stack ?? error.message,
    })
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    writeRendererDiagnostic({
      event: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
    })
  })

  window.webContents.on('did-finish-load', () => {
    window.webContents.send(ipcEventChannels.appMainProcessMessage, new Date().toLocaleString())
  })

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
    applyRuntimeSecurityPolicies(window)
    await window.loadURL(VITE_DEV_SERVER_URL)
  } else {
    applyRuntimeSecurityPolicies(window)
    await window.loadFile(indexHtmlPath)
  }

  return window
}

function writeRendererDiagnostic(details: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    ...details,
  }
  const line = JSON.stringify(entry)

  console.error(`[renderer-diagnostic] ${line}`)
  try {
    appendFileSync(path.join(app.getPath('temp'), 'lb-portal-renderer-diagnostics.log'), `${line}\n`, 'utf8')
  } catch (error) {
    console.error('[renderer-diagnostic] Could not write diagnostic file.', error)
  }
}
