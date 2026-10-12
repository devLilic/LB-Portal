import { ipcRenderer } from 'electron'
import type { IpcEventContract, IpcInvokeContract } from '../../../src/shared/ipc/contracts'

export type VoidListener = () => void

export function subscribe<TChannel extends keyof IpcEventContract>(
  channel: TChannel,
  listener: (payload: IpcEventContract[TChannel]) => void,
): VoidListener {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: IpcEventContract[TChannel]) => listener(payload)
  ipcRenderer.on(channel, wrapped)

  return () => {
    ipcRenderer.off(channel, wrapped)
  }
}

export function subscribeSignal<TChannel extends keyof IpcEventContract>(
  channel: TChannel,
  listener: () => void,
): VoidListener {
  const wrapped = () => listener()
  ipcRenderer.on(channel, wrapped)

  return () => {
    ipcRenderer.off(channel, wrapped)
  }
}

export function invoke<TChannel extends keyof IpcInvokeContract>(
  channel: TChannel,
  ...args: IpcInvokeContract[TChannel]['request'] extends void ? [] : [IpcInvokeContract[TChannel]['request']]
) {
  return ipcRenderer.invoke(channel, ...(args as unknown[])) as Promise<IpcInvokeContract[TChannel]['response']>
}
