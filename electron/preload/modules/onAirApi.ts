import { contextBridge, ipcRenderer } from 'electron'
import type { OnAirApi, OnAirPlaybackRequest, OnAirPlaybackResult, OnAirProjectSummary, OnAirState, StaticProjectGraphicPlaybackRequest, StaticProjectGraphicPlaybackResult } from '../../../src/shared/onair/contracts'
import { onAirInvokeChannels } from '../../../src/shared/onair/contracts'

export function registerOnAirApi() {
  const api: OnAirApi = {
    listProjects: () => ipcRenderer.invoke(onAirInvokeChannels.listProjects) as Promise<OnAirProjectSummary[]>,
    chooseFolder: () => ipcRenderer.invoke(onAirInvokeChannels.chooseFolder) as Promise<string | null>,
    getSnapshot: (projectId: string) => ipcRenderer.invoke(onAirInvokeChannels.getSnapshot, projectId) as Promise<OnAirState>,
    refresh: (projectId: string) => ipcRenderer.invoke(onAirInvokeChannels.refresh, projectId) as Promise<OnAirState>,
    playItem: (request: OnAirPlaybackRequest) => ipcRenderer.invoke(onAirInvokeChannels.playItem, request) as Promise<OnAirPlaybackResult>,
    playProjectGraphic: (request: StaticProjectGraphicPlaybackRequest) => ipcRenderer.invoke(onAirInvokeChannels.playProjectGraphic, request) as Promise<StaticProjectGraphicPlaybackResult>,
  }
  contextBridge.exposeInMainWorld('onAirApi', api)
}
