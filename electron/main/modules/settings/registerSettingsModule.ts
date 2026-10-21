import { app, ipcMain } from 'electron'
import {
  ipcInvokeChannels,
  type SettingsGetRequest,
  type SettingsValuePayload,
} from '../../../../src/shared/ipc/contracts'
import { createSettingsStore } from './settingsStore'
import { saveSettingFromIpc } from './settingsSave'

let settingsHandlersRegistered = false

export function registerSettingsModule() {
  if (settingsHandlersRegistered) {
    return
  }

  settingsHandlersRegistered = true

  const settingsStore = createSettingsStore(app.getPath('userData'))

  ipcMain.handle(ipcInvokeChannels.settingsGet, (event, payload: SettingsGetRequest) => {
    validateSender(event)
    return {
      key: payload.key,
      value: settingsStore.getSetting(payload.key),
    } as SettingsValuePayload
  })

  ipcMain.handle(ipcInvokeChannels.settingsSet, (event, payload: SettingsValuePayload) => {
    validateSender(event)
    return saveSettingFromIpc(settingsStore,payload)
  })
}

function validateSender(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url
  if (!url) throw new Error('Untrusted renderer.')
  if (url.startsWith('file://')) return
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl && new URL(url).origin === new URL(devUrl).origin) return
  throw new Error('Untrusted renderer.')
}
