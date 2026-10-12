import { app, ipcMain } from 'electron'
import type { AppConfig } from '../../../../config/types'
import { createLicensingLogger, createLogger } from '../../logging'
import { ipcInvokeChannels, type IpcInvokeContract } from '../../../../src/shared/ipc/contracts'
import { createSettingsStore } from '../settings/settingsStore'
import { createLicensingProvider } from './createLicensingProvider'
import { createHeartbeatScheduler } from './heartbeatScheduler'
import {
  activateLicenseWithBinding,
  sanitizeLicenseActivationResult,
  sanitizeLicenseStatusSnapshot,
} from './activateLicenseWithBinding'
import {
  createInstallationIdentityProvider,
  createMachineIdentityProvider,
  createMainProcessMachineIdentityInputProvider,
} from './device-identity'
import { confirmLicenseRebind } from './confirmLicenseRebind'
import { requestLicenseReauthorization } from './requestLicenseReauthorization'
import {
  createLicenseStatusSnapshotFromActivationResult,
  shouldStartHeartbeatForLicenseStatus,
  validateStartupLicenseBinding,
} from './validateStartupLicenseBinding'

export function registerLicensingModule(config: AppConfig) {
  const licensingLogger = createLicensingLogger(createLogger({ logging: config.logging }, 'licensing'))
  const provider = createLicensingProvider(config)
  const settingsStore = createSettingsStore(app.getPath('userData'))
  const machineIdentityProvider = createMachineIdentityProvider(
    createMainProcessMachineIdentityInputProvider(),
  )
  const installationIdentityProvider = createInstallationIdentityProvider(app.getPath('userData'))
  const heartbeatScheduler = createHeartbeatScheduler(config, provider, settingsStore, app.getVersion())
  let runtimeStatusPromise = validateStartupLicenseBinding({
    config,
    provider,
    settingsStore,
    machineIdentityProvider,
    installationIdentityProvider,
    appVersion: app.getVersion(),
  })

  void runtimeStatusPromise.then((snapshot) => {
    if (shouldStartHeartbeatForLicenseStatus(snapshot)) {
      heartbeatScheduler.start()
      if (heartbeatScheduler.isRunning()) {
        licensingLogger.schedulerStarted(config.licensing.heartbeatIntervalMs)
      }
    }
  })

  ipcMain.handle(ipcInvokeChannels.licensingGetStatus, () => {
    licensingLogger.statusQueried()
    return runtimeStatusPromise.then(sanitizeLicenseStatusSnapshot)
  })

  ipcMain.handle(
    ipcInvokeChannels.licensingActivate,
    async (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.licensingActivate]['request']) => {
      const result = await activateLicenseWithBinding(payload, {
        config,
        provider,
        settingsStore,
        machineIdentityProvider,
        installationIdentityProvider,
        appVersion: app.getVersion(),
      })
      licensingLogger.activated(result.success)
      runtimeStatusPromise = Promise.resolve(createLicenseStatusSnapshotFromActivationResult(result))
      const runtimeStatus = await runtimeStatusPromise

      if (shouldStartHeartbeatForLicenseStatus(runtimeStatus)) {
        heartbeatScheduler.start()
        if (heartbeatScheduler.isRunning()) {
          licensingLogger.schedulerStarted(config.licensing.heartbeatIntervalMs)
        }
      }

      return sanitizeLicenseActivationResult(result)
    },
  )

  ipcMain.handle(ipcInvokeChannels.licensingRequestReauthorization, () =>
    requestLicenseReauthorization({
      config,
      settingsStore,
      machineIdentityProvider,
      installationIdentityProvider,
    }),
  )

  ipcMain.handle(
    ipcInvokeChannels.licensingConfirmRebind,
    async (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.licensingConfirmRebind]['request']) => {
      const result = await confirmLicenseRebind(payload, {
        config,
        provider,
        settingsStore,
        machineIdentityProvider,
        installationIdentityProvider,
        appVersion: app.getVersion(),
      })
      licensingLogger.activated(result.success)
      runtimeStatusPromise = Promise.resolve(createLicenseStatusSnapshotFromActivationResult(result))
      const runtimeStatus = await runtimeStatusPromise

      if (shouldStartHeartbeatForLicenseStatus(runtimeStatus)) {
        heartbeatScheduler.start()
        if (heartbeatScheduler.isRunning()) {
          licensingLogger.schedulerStarted(config.licensing.heartbeatIntervalMs)
        }
      }

      return sanitizeLicenseActivationResult(result)
    },
  )

  ipcMain.handle(
    ipcInvokeChannels.licensingGetEntitlements,
    (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.licensingGetEntitlements]['request']) => {
      licensingLogger.entitlementsQueried()
      return provider.getEntitlements(payload)
    },
  )
}
