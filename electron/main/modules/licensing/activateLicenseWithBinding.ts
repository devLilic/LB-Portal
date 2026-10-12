import { createHash } from 'node:crypto'
import type { AppConfig } from '../../../../config/types'
import type {
  LicenseActivationRequest,
  LicenseActivationResult,
  LicenseStatusSnapshot,
} from '../../../../src/shared/licensing/contracts'
import type { LicensingCache } from '../../../../src/shared/settings/types'
import type { MachineIdentityProvider } from './device-identity'
import type { InstallationIdentityProvider } from './device-identity'
import type { LicensingProvider } from './LicensingProvider'
import type { SettingsStore } from '../settings/settingsStore'

export interface ActivateLicenseInput {
  key: string
  deviceName?: string
}

export interface ActivateLicenseWithBindingDependencies {
  config: AppConfig
  provider: LicensingProvider
  settingsStore: SettingsStore
  machineIdentityProvider: MachineIdentityProvider
  installationIdentityProvider: InstallationIdentityProvider
  appVersion: string | null
}

export async function activateLicenseWithBinding(
  input: ActivateLicenseInput,
  dependencies: ActivateLicenseWithBindingDependencies,
): Promise<LicenseActivationResult> {
  if (
    dependencies.config.environment !== 'production' ||
    !dependencies.config.features.licensing ||
    !dependencies.config.licensing.enabled
  ) {
    return dependencies.provider.activate(createDisabledActivationRequest(input, dependencies))
  }

  const machineIdentity = await dependencies.machineIdentityProvider.getMachineIdentity()
  const installationId = dependencies.installationIdentityProvider.getInstallationId()

  const request: LicenseActivationRequest = {
    key: input.key,
    deviceName: input.deviceName,
    device: {
      machineId: machineIdentity.machineId,
      installationId,
      fingerprintVersion: machineIdentity.fingerprint.fingerprintVersion,
      appId: dependencies.config.appName,
      appVersion: dependencies.appVersion,
    },
  }

  const result = await dependencies.provider.activate(request)

  if (!result.success) {
    return result
  }

  const licensingCache = dependencies.settingsStore.getSetting('licensingCache')

  dependencies.settingsStore.setSetting('licensingCache', {
    ...licensingCache,
    activationToken: result.activationToken,
    activationId: result.activationId,
    machineId: machineIdentity.machineId,
    installationId,
    activeLicenseKey: input.key,
    licenseKeyHash: createHash('sha256').update(input.key).digest('hex'),
    lastValidatedAt: result.activatedAt,
    graceUntil: result.graceUntil,
    lastKnownLicenseStatus: result.licenseStatus,
  })

  return result
}

function createDisabledActivationRequest(
  input: ActivateLicenseInput,
  dependencies: ActivateLicenseWithBindingDependencies,
): LicenseActivationRequest {
  return {
    key: input.key,
    deviceName: input.deviceName,
    device: {
      machineId: 'disabled-machine',
      installationId: dependencies.settingsStore.getSetting('licensingCache').installationId ?? 'disabled-installation',
      fingerprintVersion: 'machine-v1',
      appId: dependencies.config.appName,
      appVersion: dependencies.appVersion,
    },
  }
}

export function sanitizeLicenseActivationResult(
  result: LicenseActivationResult,
): Omit<LicenseActivationResult, 'activationToken'> {
  const { activationToken: _activationToken, ...safeResult } = result
  return safeResult
}

export function sanitizeLicenseStatusSnapshot(
  snapshot: LicenseStatusSnapshot,
): Omit<LicenseStatusSnapshot, 'activationToken'> {
  const { activationToken: _activationToken, ...safeSnapshot } = snapshot
  return safeSnapshot
}
