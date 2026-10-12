import { app, ipcMain } from 'electron'
import { indexHtmlPath, VITE_DEV_SERVER_URL } from '../bootstrap/paths'
import { applyRuntimeSecurityPolicies } from '../security/runtimeSecurity'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { ipcInvokeChannels, type IpcInvokeContract } from '../../../src/shared/ipc/contracts'
import type { AppConfig } from '../../../config/types'

export function registerCoreIpc(config: AppConfig) {
  ipcMain.handle(ipcInvokeChannels.appGetInfo, () => {
    return {
      appName: config.appName,
      environment: config.environment,
      version: app.getVersion(),
    }
  })

  ipcMain.handle(
    ipcInvokeChannels.appOpenWindow,
    (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.appOpenWindow]['request']) => {
    const childWindow = createSecureBrowserWindow({
      title: 'Child window',
    })
    applyRuntimeSecurityPolicies(childWindow)

    if (VITE_DEV_SERVER_URL) {
      childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${payload.route}`)
      return
    }

      childWindow.loadFile(indexHtmlPath, { hash: payload.route })
    },
  )
}
