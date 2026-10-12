import { indexHtmlPath, VITE_DEV_SERVER_URL } from './paths'
import { applyRuntimeSecurityPolicies } from '../security/runtimeSecurity'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { ipcEventChannels } from '../../../src/shared/ipc/contracts'

export async function createMainWindow() {
  const window = createSecureBrowserWindow({
    title: 'Main window',
  })

  if (VITE_DEV_SERVER_URL) {
    await window.loadURL(VITE_DEV_SERVER_URL)
    window.webContents.openDevTools()
  } else {
    await window.loadFile(indexHtmlPath)
  }

  window.webContents.on('did-finish-load', () => {
    window.webContents.send(ipcEventChannels.appMainProcessMessage, new Date().toLocaleString())
  })

  applyRuntimeSecurityPolicies(window)

  return window
}
