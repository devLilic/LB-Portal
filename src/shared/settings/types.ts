import type { AppLanguage } from '../../../config/types'
import type {
  ActivationToken,
  InstallationId,
  MachineId,
} from '../licensing/device-identity'
import type { LicenseStatus } from '../licensing/contracts'

export interface UpdatePreferences {
  autoCheck: boolean
  downloadStrategy: 'manual'
}

export interface LicensingCache {
  activationToken: ActivationToken | null
  activationId: string | null
  machineId: MachineId | null
  installationId: InstallationId | null
  lastValidatedAt: string | null
  graceUntil: string | null
  lastKnownLicenseStatus: LicenseStatus | null
  lastHeartbeatAt: string | null
  licenseKeyHash: string | null
  activeLicenseKey: string | null
}

export interface UiPreferences {
  theme: 'system' | 'light' | 'dark'
  density: 'comfortable' | 'compact'
}

export interface AppSettings {
  language: AppLanguage | null
  updatePreferences: UpdatePreferences
  licensingCache: LicensingCache
  uiPreferences: UiPreferences
}

export type SettingsKey = keyof AppSettings
