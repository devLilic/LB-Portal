import { contextBridge, ipcRenderer } from 'electron'
import type { PreloadModule } from '../../../src/shared/modules/contracts'
import type { ReceivedRequest, ReceiverInfo } from '../../../src/shared/ingress/contracts'
import { ingressEventChannels, ingressInvokeChannels } from '../../../src/shared/ingress/channels'
import { liveBoardEventChannels, liveBoardInvokeChannels, type LiveBoardApi, type LiveBoardSnapshot, type LiveBoardResyncState, type LiveBoardStopAllResult, type ProjectActivationResult } from '../../../src/shared/liveboard/runtime'

export function createLBPortalApiPreloadModule(): PreloadModule {
  return {
    id: 'lb-portal-api',
    register() {
      contextBridge.exposeInMainWorld('lbPortalApi', {
        getInfo: () => ipcRenderer.invoke(ingressInvokeChannels.getInfo) as Promise<ReceiverInfo>,
        getRequests: () => ipcRenderer.invoke(ingressInvokeChannels.getRequests) as Promise<ReceivedRequest[]>,
        clearRequests: () => ipcRenderer.invoke(ingressInvokeChannels.clearRequests) as Promise<void>,
        onRequestReceived(listener: (request: ReceivedRequest) => void) {
          const handler = (_event: Electron.IpcRendererEvent, request: ReceivedRequest) => listener(request)
          ipcRenderer.on(ingressEventChannels.requestReceived, handler)
          return () => ipcRenderer.removeListener(ingressEventChannels.requestReceived, handler)
        },
        onRequestUpdated(listener: (request: ReceivedRequest) => void) {
          const handler = (_event: Electron.IpcRendererEvent, request: ReceivedRequest) => listener(request)
          ipcRenderer.on(ingressEventChannels.requestUpdated, handler)
          return () => ipcRenderer.removeListener(ingressEventChannels.requestUpdated, handler)
        },
      })
      contextBridge.exposeInMainWorld('liveBoardApi', {
        getSnapshot: () => ipcRenderer.invoke(liveBoardInvokeChannels.getSnapshot) as Promise<LiveBoardSnapshot>,
        connect: () => ipcRenderer.invoke(liveBoardInvokeChannels.connect) as Promise<LiveBoardSnapshot>,
        disconnect: () => ipcRenderer.invoke(liveBoardInvokeChannels.disconnect) as Promise<LiveBoardSnapshot>,
        takeOutSection: (sectionId: string) => ipcRenderer.invoke(liveBoardInvokeChannels.takeOut, sectionId) as Promise<LiveBoardSnapshot>,
        stopSection: (sectionId: string) => ipcRenderer.invoke(liveBoardInvokeChannels.stop, sectionId) as Promise<LiveBoardSnapshot>,
        stopAllProjectSections: (projectId: string) => ipcRenderer.invoke(liveBoardInvokeChannels.stopAll, projectId) as Promise<LiveBoardStopAllResult>,
        resyncSection: (sectionId: string, state: LiveBoardResyncState) => ipcRenderer.invoke(liveBoardInvokeChannels.resync, sectionId, state) as Promise<LiveBoardSnapshot>,
        setActiveProject: (projectId:string) => ipcRenderer.invoke(liveBoardInvokeChannels.setActiveProject,projectId) as Promise<ProjectActivationResult>,
        onSnapshot(listener: (snapshot: LiveBoardSnapshot) => void) {
          const handler = (_event: Electron.IpcRendererEvent, snapshot: LiveBoardSnapshot) => listener(snapshot)
          ipcRenderer.on(liveBoardEventChannels.snapshot, handler)
          return () => ipcRenderer.removeListener(liveBoardEventChannels.snapshot, handler)
        },
      } satisfies LiveBoardApi)
    },
  }
}
