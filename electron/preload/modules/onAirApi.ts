import { contextBridge, ipcRenderer } from 'electron'
import type { OnAirApi, OnAirProjectSummary, OnAirState } from '../../../src/shared/onair/contracts'
import { onAirInvokeChannels } from '../../../src/shared/onair/contracts'

export function registerOnAirApi() {
  const api: OnAirApi = {
    listProjects: () => ipcRenderer.invoke(onAirInvokeChannels.listProjects) as Promise<OnAirProjectSummary[]>,
    chooseFolder: () => ipcRenderer.invoke(onAirInvokeChannels.chooseFolder) as Promise<string | null>,
    getSnapshot: (projectId: string) => ipcRenderer.invoke(onAirInvokeChannels.getSnapshot, projectId) as Promise<OnAirState>,
    refresh: (projectId: string) => ipcRenderer.invoke(onAirInvokeChannels.refresh, projectId) as Promise<OnAirState>,
  }
  contextBridge.exposeInMainWorld('onAirApi', api)
}
