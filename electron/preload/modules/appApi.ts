import { contextBridge } from 'electron'
import type { AppConfig } from '../../../config/types'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import { invoke, subscribe } from './shared'

export function registerAppApi(config: AppConfig) {
  contextBridge.exposeInMainWorld('appApi', {
    getConfig() {
      return config
    },
    getAppInfo() {
      return invoke(ipcInvokeChannels.appGetInfo)
    },
    onMainProcessMessage(listener: (message: string) => void) {
      return subscribe(ipcEventChannels.appMainProcessMessage, listener)
    },
    openWindow(route: string) {
      return invoke(ipcInvokeChannels.appOpenWindow, { route })
    },
  })
}
