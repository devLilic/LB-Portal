import { contextBridge } from 'electron'
import type { ProgressInfo } from 'electron-updater'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from '../../../src/shared/types/update'
import { invoke, subscribe, subscribeSignal } from './shared'

export function registerUpdateApi() {
  contextBridge.exposeInMainWorld('updateApi', {
    checkForUpdates() {
      return invoke(ipcInvokeChannels.updateCheckForUpdates)
    },
    downloadUpdate() {
      return invoke(ipcInvokeChannels.updateStartDownload)
    },
    quitAndInstall() {
      return invoke(ipcInvokeChannels.updateQuitAndInstall)
    },
    onStateChange(listener: (event: UpdateStateEvent) => void) {
      return subscribe(ipcEventChannels.updateStateChanged, listener)
    },
    onAvailabilityChanged(listener: (payload: VersionInfo) => void) {
      return subscribe(ipcEventChannels.updateAvailabilityChanged, listener)
    },
    onError(listener: (payload: UpdateErrorPayload) => void) {
      return subscribe(ipcEventChannels.updateError, listener)
    },
    onDownloadProgress(listener: (payload: ProgressInfo) => void) {
      return subscribe(ipcEventChannels.updateDownloadProgress, listener)
    },
    onDownloaded(listener: () => void) {
      return subscribeSignal(ipcEventChannels.updateDownloaded, listener)
    },
  })
}
