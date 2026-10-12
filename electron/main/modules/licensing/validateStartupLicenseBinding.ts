import type { AppConfig } from '../../../../config/types'
import {
  resolveAntiClonePolicy,
  type AntiClonePolicyResult,
  type DeviceValidationStatus,
} from '../../../../src/shared/licensing/device-identity'
import type {
  LicenseActivationResult,
  LicenseReasonCode,
  LicenseStatus,
  LicenseStatusSnapshot,
  LicenseValidationResult,
} from '../../../../src/shared/licensing/contracts'
import type { LicensingCache } from '../../../../src/shared/settings/types'
import type { SettingsStore } from '../settings/settingsStore'
import type { InstallationIdentityProvider, MachineIdentityProvider } from './device-identity'
import type { LicensingProvider } from './LicensingProvider'
import { createInactiveLicenseStatus, createLicenseGracePeriod } from './shared'

export interface ValidateStartupLicenseBindingDependencies {
  config: AppConfig
  provider: LicensingProvider
  settingsStore: SettingsStore
  machineIdentityProvider: MachineIdentityProvider
  installationIdentityProvider: InstallationIdentityProvider
  appVersion: string | null
}

export async function validateStartupLicenseBinding(
  dependencies: ValidateStartupLicenseBindingDependencies,
): Promise<LicenseStatusSnapshot> {
  if (!isProductionLicensingEnabled(dependencies.config)) {
    return createInactiveLicenseStatus(dependencies.config)
  }

  const licensingCache = dependencies.settingsStore.getSetting('licensingCache')

  if (!hasStartupActivationBinding(licensingCache)) {
    return createUnlicensedStartupStatus(dependencies.config)
  }

  const machineIdentity = await dependencies.machineIdentityProvider.getMachineIdentity()
  const installationId = dependencies.installationIdentityProvider.getInstallationId()
  const deviceBindingEnabled = isDeviceBindingEnabled(dependencies.config)

  if (
    deviceBindingEnabled &&
    (
      (dependencies.config.licensing.enforceMachineMatch &&
        licensingCache.machineId !== machineIdentity.machineId) ||
      licensingCache.installationId !== installationId
    )
  ) {
    return createAntiCloneStatusSnapshot(
      dependencies.config,
      licensingCache,
      resolveAntiClonePolicy({
        currentMachineId: machineIdentity.machineId,
        storedMachineId: licensingCache.machineId,
        installationId,
        storedInstallationId: licensingCache.installationId,
        serverStatus:
          dependencies.config.licensing.enforceMachineMatch &&
          licensingCache.machineId !== machineIdentity.machineId
            ? 'device_mismatch'
            : 'reauthorization_required',
        graceUntil: licensingCache.graceUntil,
      }),
    )
  }

  const result = await dependencies.provider.validate({
    key: licensingCache.activeLicenseKey,
    lastValidatedAt: licensingCache.lastValidatedAt,
    device: {
      machineId: machineIdentity.machineId,
      installationId,
      fingerprintVersion: machineIdentity.fingerprint.fingerprintVersion,
      appId: dependencies.config.appName,
      appVersion: dependencies.appVersion,
    },
  })

  if (deviceBindingEnabled) {
    const antiClone = resolveAntiClonePolicy({
      currentMachineId: machineIdentity.machineId,
      storedMachineId: licensingCache.machineId,
      installationId,
      storedInstallationId: licensingCache.installationId,
      serverStatus: mapValidationResultToDeviceStatus(result),
      graceUntil: result.graceUntil ?? licensingCache.graceUntil,
    })

    if (antiClone.resolution === 'block_clone' || antiClone.resolution === 'require_reactivation') {
      return createAntiCloneStatusSnapshot(dependencies.config, licensingCache, antiClone)
    }
  }

  persistValidatedLicensingCache(dependencies.settingsStore, licensingCache, result)
  return createLicenseStatusSnapshotFromValidationResult(result)
}

export function createLicenseStatusSnapshotFromActivationResult(
  result: LicenseActivationResult,
): LicenseStatusSnapshot {
  return {
    enabled: true,
    status: result.status,
    licenseStatus: result.licenseStatus,
    activated: result.success,
    validated: false,
    lastValidatedAt: result.activatedAt,
    activationId: result.activationId,
    activationToken: result.activationToken,
    graceUntil: result.graceUntil,
    reasonCode: result.reasonCode,
    entitlements: result.entitlements,
    gracePeriod: result.gracePeriod,
    degradedMode: result.degradedMode,
  }
}

export function shouldStartHeartbeatForLicenseStatus(snapshot: LicenseStatusSnapshot) {
  return (
    snapshot.enabled &&
    snapshot.activated &&
    snapshot.reasonCode !== 'device_mismatch' &&
    snapshot.reasonCode !== 'clone_suspected' &&
    snapshot.reasonCode !== 'reauthorization_required' &&
    snapshot.status !== 'unlicensed'
  )
}

function isProductionLicensingEnabled(config: AppConfig) {
  return (
    config.environment === 'production' &&
    config.features.licensing &&
    config.licensing.enabled
  )
}

function isDeviceBindingEnabled(config: AppConfig) {
  return isProductionLicensingEnabled(config) && config.licensing.deviceBinding
}

function hasStartupActivationBinding(cache: LicensingCache): cache is LicensingCache & {
  activeLicenseKey: string
  activationId: string
  activationToken: string
  installationId: string
  machineId: string
} {
  return !!(
    cache.activeLicenseKey &&
    cache.activationId &&
    cache.activationToken &&
    cache.installationId &&
    cache.machineId
  )
}

function persistValidatedLicensingCache(
  settingsStore: SettingsStore,
  licensingCache: LicensingCache,
  result: LicenseValidationResult,
) {
  settingsStore.setSetting('licensingCache', {
    ...licensingCache,
    activationId: result.activationId ?? licensingCache.activationId,
    activationToken: result.activationToken ?? licensingCache.activationToken,
    lastValidatedAt: result.validatedAt ?? licensingCache.lastValidatedAt,
    graceUntil: result.graceUntil ?? licensingCache.graceUntil,
    lastKnownLicenseStatus: result.licenseStatus,
  })
}

function createUnlicensedStartupStatus(config: AppConfig): LicenseStatusSnapshot {
  return {
    enabled: true,
    status: 'unlicensed',
    licenseStatus: 'unlicensed',
    activated: false,
    validated: false,
    lastValidatedAt: null,
    activationId: null,
    activationToken: null,
    graceUntil: null,
    reasonCode: 'none',
    entitlements: {
      items: [],
    },
    gracePeriod: createLicenseGracePeriod(config),
    degradedMode: {
      active: false,
      mode: 'none',
      reason: null,
    },
  }
}

function createAntiCloneStatusSnapshot(
  config: AppConfig,
  licensingCache: LicensingCache,
  antiClone: AntiClonePolicyResult,
): LicenseStatusSnapshot {
  const blocked = antiClone.resolution === 'block_clone'
  const allowGraceOnMismatch =
    config.licensing.allowGraceOnMismatch &&
    antiClone.graceActive &&
    (antiClone.machineMismatch || antiClone.installationMismatch)
  const status = allowGraceOnMismatch ? 'grace-period' : 'degraded'
  const validated = allowGraceOnMismatch
  const reasonCode = allowGraceOnMismatch ? 'none' : mapDeviceValidationStatusToReasonCode(antiClone.status)

  return {
    enabled: true,
    status,
    licenseStatus: status,
    activated: true,
    validated,
    lastValidatedAt: licensingCache.lastValidatedAt,
    activationId: licensingCache.activationId,
    activationToken: licensingCache.activationToken,
    graceUntil: licensingCache.graceUntil,
    reasonCode,
    entitlements: {
      items: [],
    },
    gracePeriod: {
      active: allowGraceOnMismatch,
      startedAt: licensingCache.lastValidatedAt,
      endsAt: licensingCache.graceUntil,
      remainingDays: antiClone.graceActive ? config.licensing.gracePeriodDays : 0,
    },
    degradedMode: {
      active: !allowGraceOnMismatch,
      mode: blocked ? 'blocked' : config.licensing.degradedMode,
      reason: allowGraceOnMismatch ? null : antiClone.reason,
    },
  }
}

function createLicenseStatusSnapshotFromValidationResult(
  result: LicenseValidationResult,
): LicenseStatusSnapshot {
  return {
    enabled: true,
    status: result.status,
    licenseStatus: result.licenseStatus,
    activated: true,
    validated: result.valid,
    lastValidatedAt: result.validatedAt,
    activationId: result.activationId,
    activationToken: result.activationToken,
    graceUntil: result.graceUntil,
    reasonCode: result.reasonCode,
    entitlements: result.entitlements,
    gracePeriod: result.gracePeriod,
    degradedMode: result.degradedMode,
  }
}

function mapValidationResultToDeviceStatus(
  result: LicenseValidationResult,
): DeviceValidationStatus {
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

function mapDeviceValidationStatusToReasonCode(
  status: DeviceValidationStatus,
): LicenseReasonCode {
  if (status === 'invalid_license') {
    return 'invalid_license'
  }

  if (status === 'expired') {
    return 'expired'
  }

  if (status === 'revoked') {
    return 'revoked'
  }

  if (status === 'device_limit_exceeded') {
    return 'device_limit_exceeded'
  }

  if (status === 'device_mismatch') {
    return 'device_mismatch'
  }

  if (status === 'clone_suspected') {
    return 'clone_suspected'
  }

  if (status === 'reauthorization_required') {
    return 'reauthorization_required'
  }

  return 'none'
}
