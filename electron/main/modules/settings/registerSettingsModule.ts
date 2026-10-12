import { app, ipcMain } from 'electron'
import {
  ipcInvokeChannels,
  type SettingsGetRequest,
  type SettingsValuePayload,
} from '../../../../src/shared/ipc/contracts'
import { createSettingsStore } from './settingsStore'
import type { AppSettings, SettingsKey } from '../../../../src/shared/settings/types'

let settingsHandlersRegistered = false

export function registerSettingsModule() {
  if (settingsHandlersRegistered) {
    return
  }

  settingsHandlersRegistered = true

  const settingsStore = createSettingsStore(app.getPath('userData'))

  ipcMain.handle(ipcInvokeChannels.settingsGet, (_event, payload: SettingsGetRequest) => {
    return {
      key: payload.key,
      value: settingsStore.getSetting(payload.key),
    } as SettingsValuePayload
  })

  ipcMain.handle(ipcInvokeChannels.settingsSet, (_event, payload: SettingsValuePayload) => {
    const key = payload.key as SettingsKey
    const value = payload.value as AppSettings[typeof key]

    return {
      key,
      value: settingsStore.setSetting(key, value),
    } as SettingsValuePayload
  })
}
