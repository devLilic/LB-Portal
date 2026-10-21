import { app, dialog, ipcMain } from 'electron'
import path from 'node:path'
import type { MainModuleContext } from '../../../src/shared/modules/contracts'
import { onAirInvokeChannels } from '../../../src/shared/onair/contracts'
import { createSettingsStore } from '../modules/settings/settingsStore'
import { createOnAirCsvService } from './onAirCsvService'
import { validateOnAirIpcSender } from './validateOnAirIpcSender'

let registered = false

export function registerOnAirCsvModule(context: MainModuleContext) {
  if (registered) return
  registered = true
  const userData = app.getPath('userData')
  const store = createSettingsStore(userData)
  const service = createOnAirCsvService(store, userData)
  app.once('before-quit', () => service.dispose())

  ipcMain.handle(onAirInvokeChannels.listProjects, event => {
    validateSender(event, context)
    return service.listProjects()
  })
  ipcMain.handle(onAirInvokeChannels.chooseFolder, async event => {
    validateSender(event, context)
    const window = context.getMainWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      title: 'Selectează folderul CSV OnAir',
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled || result.filePaths.length === 0 ? null : path.resolve(result.filePaths[0])
  })
  ipcMain.handle(onAirInvokeChannels.getSnapshot, (event, projectId: unknown) => {
    validateSender(event, context)
    return service.getSnapshot(validateProjectId(projectId))
  })
  ipcMain.handle(onAirInvokeChannels.refresh, (event, projectId: unknown) => {
    validateSender(event, context)
    return service.refresh(validateProjectId(projectId))
  })
}

function validateProjectId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) throw new Error('Invalid project id.')
  return value
}

function validateSender(event: Electron.IpcMainInvokeEvent, context: MainModuleContext) {
  validateOnAirIpcSender(event, context.getMainWindow())
}
