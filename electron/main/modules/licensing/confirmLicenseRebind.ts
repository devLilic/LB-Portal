import type { AppConfig } from '../../../../config/types'
import type { LicenseActivationResult } from '../../../../src/shared/licensing/contracts'
import { activateLicenseWithBinding, type ActivateLicenseInput } from './activateLicenseWithBinding'
import type { InstallationIdentityProvider, MachineIdentityProvider } from './device-identity'
import type { LicensingProvider } from './LicensingProvider'
import type { SettingsStore } from '../settings/settingsStore'

export interface ConfirmLicenseRebindDependencies {
  config: AppConfig
  provider: LicensingProvider
  settingsStore: SettingsStore
  machineIdentityProvider: MachineIdentityProvider
  installationIdentityProvider: InstallationIdentityProvider
  appVersion: string | null
}

export async function confirmLicenseRebind(
  input: ActivateLicenseInput,
  dependencies: ConfirmLicenseRebindDependencies,
): Promise<LicenseActivationResult> {
  return activateLicenseWithBinding(input, dependencies)
}
