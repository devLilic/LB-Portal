import type { AppConfig } from '../../../../config/types'
import { resolveAntiClonePolicy, type DeviceValidationStatus } from '../../../../src/shared/licensing/device-identity'
import type { LicenseHeartbeatResult } from '../../../../src/shared/licensing/contracts'
import type { LicensingCache } from '../../../../src/shared/settings/types'
import type { SettingsStore } from '../settings/settingsStore'
import type { LicensingProvider } from './LicensingProvider'

export interface HeartbeatScheduler {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

type TimerHandle = ReturnType<typeof setInterval>

export function isHeartbeatSchedulerEnabled(config: AppConfig) {
  return (
    config.environment === 'production' &&
    config.features.licensing &&
    config.licensing.enabled &&
    config.licensing.heartbeatIntervalMs > 0
  )
}

export function createHeartbeatScheduler(
  config: AppConfig,
  provider: LicensingProvider,
  settingsStore: SettingsStore,
  appVersion: string | null,
): HeartbeatScheduler {
  let intervalHandle: TimerHandle | null = null

  return {
    start() {
      if (!isHeartbeatSchedulerEnabled(config) || intervalHandle) {
        return
      }

      intervalHandle = setInterval(() => {
        void runHeartbeat(config, provider, settingsStore, appVersion)
      }, config.licensing.heartbeatIntervalMs)
    },
    stop() {
      if (!intervalHandle) {
        return
      }

      clearInterval(intervalHandle)
      intervalHandle = null
    },
    isRunning() {
      return intervalHandle !== null
    },
  }
}

async function runHeartbeat(
  config: AppConfig,
  provider: LicensingProvider,
  settingsStore: SettingsStore,
  appVersion: string | null,
) {
  const licensingCache = settingsStore.getSetting('licensingCache')

  if (
    !licensingCache.activeLicenseKey ||
    !licensingCache.activationId ||
    !licensingCache.installationId ||
    !licensingCache.machineId
  ) {
    return
  }

  const result = await provider.heartbeat({
    key: licensingCache.activeLicenseKey,
    activationId: licensingCache.activationId,
    device: {
      machineId: licensingCache.machineId,
      installationId: licensingCache.installationId,
      fingerprintVersion: 'machine-v1',
      appId: config.appName,
      appVersion,
    },
    lastHeartbeatAt: licensingCache.lastHeartbeatAt,
  })

  const nextLicensingCache = resolveHeartbeatLicensingCacheUpdate(config, licensingCache, result)

  if (nextLicensingCache) {
    settingsStore.setSetting('licensingCache', nextLicensingCache)
  }
}

export function resolveHeartbeatLicensingCacheUpdate(
  config: AppConfig,
  licensingCache: LicensingCache,
  result: LicenseHeartbeatResult,
): LicensingCache | null {
  if (!licensingCache.machineId || !licensingCache.installationId) {
    return null
  }

  if (!config.licensing.deviceBinding) {
    return {
      ...licensingCache,
      activationId: result.activationId ?? licensingCache.activationId,
      activationToken: result.activationToken ?? licensingCache.activationToken,
      lastHeartbeatAt: result.heartbeatAt ?? licensingCache.lastHeartbeatAt,
      lastValidatedAt:
        result.status === 'active' || result.status === 'grace-period'
          ? result.heartbeatAt ?? licensingCache.lastValidatedAt
          : licensingCache.lastValidatedAt,
      graceUntil: result.graceUntil ?? licensingCache.graceUntil,
      lastKnownLicenseStatus: result.licenseStatus,
    }
  }

  const antiClone = resolveAntiClonePolicy({
    currentMachineId: licensingCache.machineId,
    storedMachineId: licensingCache.machineId,
    installationId: licensingCache.installationId,
    storedInstallationId: licensingCache.installationId,
    serverStatus: mapHeartbeatResultToDeviceStatus(result),
    graceUntil: result.graceUntil ?? licensingCache.graceUntil,
  })

  if (antiClone.resolution === 'block_clone' || antiClone.resolution === 'require_reactivation') {
    return null
  }

  return {
    ...licensingCache,
    activationId: result.activationId ?? licensingCache.activationId,
    activationToken: result.activationToken ?? licensingCache.activationToken,
    lastHeartbeatAt: result.heartbeatAt ?? licensingCache.lastHeartbeatAt,
    lastValidatedAt:
      result.status === 'active' || result.status === 'grace-period'
        ? result.heartbeatAt ?? licensingCache.lastValidatedAt
        : licensingCache.lastValidatedAt,
    graceUntil: result.graceUntil ?? licensingCache.graceUntil,
    lastKnownLicenseStatus: result.licenseStatus,
  }
}

function mapHeartbeatResultToDeviceStatus(result: LicenseHeartbeatResult): DeviceValidationStatus {
  if (result.reasonCode === 'device_limit_exceeded') {
    return 'device_limit_exceeded'
  }

  if (result.reasonCode === 'device_mismatch') {
    return 'device_mismatch'
  }

  if (result.reasonCode === 'clone_suspected') {
    return 'clone_suspected'
  }

  if (result.reasonCode === 'reauthorization_required') {
    return 'reauthorization_required'
  }

  if (result.reasonCode === 'invalid_license' || result.status === 'invalid') {
    return 'invalid_license'
  }

  if (result.reasonCode === 'expired' || result.status === 'expired') {
    return 'expired'
  }

  if (result.reasonCode === 'revoked' || result.status === 'revoked') {
    return 'revoked'
  }

  if (result.status === 'grace-period') {
    return 'grace'
  }

  return 'valid'
}
