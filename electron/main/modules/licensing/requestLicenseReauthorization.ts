import type { AppConfig } from '../../../../config/types'
import type { LicenseReauthorizationSummary } from '../../../../src/shared/licensing/contracts'
import type { SettingsStore } from '../settings/settingsStore'
import type { InstallationIdentityProvider, MachineIdentityProvider } from './device-identity'

export interface RequestLicenseReauthorizationDependencies {
  config: AppConfig
  settingsStore: SettingsStore
  machineIdentityProvider: MachineIdentityProvider
  installationIdentityProvider: InstallationIdentityProvider
}

export async function requestLicenseReauthorization(
  dependencies: RequestLicenseReauthorizationDependencies,
): Promise<LicenseReauthorizationSummary> {
  const licensingCache = dependencies.settingsStore.getSetting('licensingCache')

  if (
    dependencies.config.environment !== 'production' ||
    !dependencies.config.features.licensing ||
    !dependencies.config.licensing.enabled ||
    !dependencies.config.licensing.deviceBinding
  ) {
    return {
      available: false,
      required: false,
      activated: false,
      hasStoredActivation: false,
      machineMismatch: false,
      installationMismatch: false,
      reasonCode: 'none',
    }
  }

  const hasStoredActivation = !!(
    licensingCache.activationId &&
    licensingCache.activationToken &&
    licensingCache.activeLicenseKey &&
    licensingCache.machineId &&
    licensingCache.installationId
  )

  if (!hasStoredActivation) {
    return {
      available: false,
      required: false,
      activated: false,
      hasStoredActivation: false,
      machineMismatch: false,
      installationMismatch: false,
      reasonCode: 'none',
    }
  }

  const machineIdentity = await dependencies.machineIdentityProvider.getMachineIdentity()
  const installationId = dependencies.installationIdentityProvider.getInstallationId()
  const machineMismatch = licensingCache.machineId !== machineIdentity.machineId
  const installationMismatch = licensingCache.installationId !== installationId
  const reasonCode = machineMismatch
    ? 'device_mismatch'
    : installationMismatch
      ? 'reauthorization_required'
      : 'none'

  return {
    available: true,
    required: machineMismatch || installationMismatch,
    activated: true,
    hasStoredActivation: true,
    machineMismatch,
    installationMismatch,
    reasonCode,
  }
}
