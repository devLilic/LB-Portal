import { randomUUID } from 'node:crypto'
import { createSettingsStore, type SettingsStore } from '../../settings/settingsStore'
import type { InstallationId } from '../../../../../src/shared/licensing/device-identity'
import type { InstallationIdentityProvider } from './InstallationIdentityProvider'

export interface CreateInstallationIdentityProviderOptions {
  settingsStore?: SettingsStore
  createInstallationId?: () => InstallationId
}

export function createInstallationIdentityProvider(
  storageDir: string,
  options: CreateInstallationIdentityProviderOptions = {},
): InstallationIdentityProvider {
  const settingsStore = options.settingsStore ?? createSettingsStore(storageDir)
  const createInstallationId = options.createInstallationId ?? randomUUID

  return {
    getInstallationId() {
      const cachedInstallationId = settingsStore.getSetting('licensingCache').installationId

      if (cachedInstallationId) {
        return cachedInstallationId
      }

      const installationId = createInstallationId()
      const licensingCache = settingsStore.getSetting('licensingCache')

      settingsStore.setSetting('licensingCache', {
        ...licensingCache,
        installationId,
      })

      return installationId
    },
  }
}
