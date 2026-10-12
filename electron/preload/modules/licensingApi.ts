import { contextBridge } from 'electron'
import {
  ipcInvokeChannels,
  type LicensingActivationPayload,
  type LicensingConfirmRebindPayload,
  type LicensingDegradedModePayload,
  type LicensingEntitlementsPayload,
  type LicensingStatusPayload,
} from '../../../src/shared/ipc/contracts'
import { invoke } from './shared'

export function toLicensingDegradedModeState(
  status: LicensingStatusPayload,
): LicensingDegradedModePayload {
  return {
    activated: status.activated,
    validated: status.validated,
    status: status.status,
    reasonCode: status.reasonCode ?? 'none',
    gracePeriod: status.gracePeriod,
    degradedMode: status.degradedMode,
  }
}

export function registerLicensingApi() {
  contextBridge.exposeInMainWorld('licensingApi', {
    getStatus() {
      return invoke(ipcInvokeChannels.licensingGetStatus)
    },
    async getDegradedModeState() {
      const status = await invoke(ipcInvokeChannels.licensingGetStatus)
      return toLicensingDegradedModeState(status)
    },
    activateLicense(payload: LicensingActivationPayload) {
      return invoke(ipcInvokeChannels.licensingActivate, payload)
    },
    requestReauthorization() {
      return invoke(ipcInvokeChannels.licensingRequestReauthorization)
    },
    confirmRebind(payload: LicensingConfirmRebindPayload) {
      return invoke(ipcInvokeChannels.licensingConfirmRebind, payload)
    },
    getEntitlements(payload: LicensingEntitlementsPayload) {
      return invoke(ipcInvokeChannels.licensingGetEntitlements, payload)
    },
  })
}
