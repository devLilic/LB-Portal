import { app, ipcMain, type BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from 'electron-updater'
import type { AppConfig } from '../../../../config/types'
import { createLogger, createUpdateLogger } from '../../logging'
import { ipcEventChannels, ipcInvokeChannels } from '../../../../src/shared/ipc/contracts'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater')

let autoUpdateHandlersRegistered = false

export function registerAutoUpdateModule(
  getMainWindow: () => BrowserWindow | null,
  config: AppConfig,
) {
  const updateLogger = createUpdateLogger(createLogger({ logging: config.logging }, 'updates'))

  if (autoUpdateHandlersRegistered) {
    return
  }

  autoUpdateHandlersRegistered = true

  autoUpdater.autoDownload = config.update.autoDownload
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = config.update.allowPrerelease

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    updateLogger.stateChanged('update-available', { version: info.version })
    const payload = {
      update: true,
      version: app.getVersion(),
      newVersion: info.version,
    }

    getMainWindow()?.webContents.send(ipcEventChannels.updateAvailabilityChanged, payload)
    getMainWindow()?.webContents.send(ipcEventChannels.updateStateChanged, {
      type: 'availability-changed',
      payload,
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    updateLogger.stateChanged('update-not-available', { version: info.version })
    const payload = {
      update: false,
      version: app.getVersion(),
      newVersion: info.version,
    }

    getMainWindow()?.webContents.send(ipcEventChannels.updateAvailabilityChanged, payload)
    getMainWindow()?.webContents.send(ipcEventChannels.updateStateChanged, {
      type: 'availability-changed',
      payload,
    })
  })

  ipcMain.handle(ipcInvokeChannels.updateCheckForUpdates, async () => {
    if (!config.features.autoUpdate) {
      updateLogger.disabled('feature-disabled')
      return {
        message: 'Auto update is disabled by configuration.',
        error: new Error('Auto update is disabled by configuration.'),
      }
    }

    if (!app.isPackaged) {
      updateLogger.disabled('app-not-packaged')
      return {
        message: 'The update feature is only available after packaging.',
        error: new Error('The update feature is only available after packaging.'),
      }
    }

    try {
      return await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      updateLogger.failed('checkForUpdates', error)
      return { message: 'Network error', error }
    }
  })

  ipcMain.handle(ipcInvokeChannels.updateStartDownload, (event) => {
    startDownload(
      (error, progressInfo) => {
        if (error) {
          updateLogger.failed('downloadUpdate', error)
          event.sender.send(ipcEventChannels.updateError, { message: error.message, error })
          event.sender.send(ipcEventChannels.updateStateChanged, {
            type: 'error',
            payload: { message: error.message, error },
          })
          return
        }

        event.sender.send(ipcEventChannels.updateDownloadProgress, progressInfo)
        event.sender.send(ipcEventChannels.updateStateChanged, {
          type: 'download-progress',
          payload: progressInfo,
        })
      },
      () => {
        event.sender.send(ipcEventChannels.updateDownloaded)
        event.sender.send(ipcEventChannels.updateStateChanged, {
          type: 'downloaded',
        })
      },
    )
  })

  ipcMain.handle(ipcInvokeChannels.updateQuitAndInstall, () => {
    updateLogger.stateChanged('quit-and-install')
    autoUpdater.quitAndInstall(false, true)
  })

  if (config.update.autoCheck && app.isPackaged) {
    void autoUpdater.checkForUpdates().catch(() => undefined)
  }
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void,
) {
  autoUpdater.once('error', (error: Error) => callback(error, null))
  autoUpdater.on('download-progress', (info: ProgressInfo) => callback(null, info))
  autoUpdater.once('update-downloaded', complete)
  autoUpdater.downloadUpdate()
}
