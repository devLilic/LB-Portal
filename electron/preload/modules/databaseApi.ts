import { contextBridge } from 'electron'
import { ipcInvokeChannels, type DatabaseQueryPayload } from '../../../src/shared/ipc/contracts'
import { invoke } from './shared'

export function registerDatabaseApi() {
  contextBridge.exposeInMainWorld('databaseApi', {
    query(payload: DatabaseQueryPayload) {
      return invoke(ipcInvokeChannels.databaseQuery, payload)
    },
  })
}
