import { describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../../../config/loadConfig'
import { confirmLicenseRebind } from '../../../electron/main/modules/licensing/confirmLicenseRebind'
import type { InstallationIdentityProvider, MachineIdentityProvider } from '../../../electron/main/modules/licensing/device-identity'
import type { LicensingProvider } from '../../../electron/main/modules/licensing/LicensingProvider'
import { requestLicenseReauthorization } from '../../../electron/main/modules/licensing/requestLicenseReauthorization'
import type { SettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import type { LicensingCache } from '../../../src/shared/settings/types'

describe('license reauthorization flow', () => {
  it('reports explicit reauthorization as required when the current machine differs from the stored binding', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = createLicensingCacheState({
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      activeLicenseKey: 'license-key',
    })
    const settingsStore = createSettingsStoreStub(settings)

    const result = await requestLicenseReauthorization({
      config,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-2'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-1'),
    })

    expect(result).toEqual({
      available: true,
      required: true,
      activated: true,
      hasStoredActivation: true,
      machineMismatch: true,
      installationMismatch: false,
      reasonCode: 'device_mismatch',
    })
    expect(settingsStore.setSetting).not.toHaveBeenCalled()
  })

  it('confirms rebind only through the explicit entry point and updates the local binding', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = createLicensingCacheState({
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      activeLicenseKey: 'old-license-key',
    })
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(async () => ({
        success: true,
        status: 'active' as const,
        licenseStatus: 'active' as const,
        activationId: 'activation-2',
        activationToken: 'token-2',
        activatedAt: '2026-03-27T12:00:00.000Z',
        graceUntil: null,
        reasonCode: 'none' as const,
        entitlements: {
          items: [],
        },
        gracePeriod: {
          active: false,
          startedAt: null,
          endsAt: null,
          remainingDays: 7,
        },
        degradedMode: {
          active: false,
          mode: 'none' as const,
          reason: null,
        },
      })),
      validate: vi.fn(),
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await confirmLicenseRebind(
      {
        key: 'new-license-key',
        deviceName: 'Migrated Desktop',
      },
      {
        config,
        provider,
        settingsStore,
        machineIdentityProvider: createMachineIdentityProviderStub('machine-2'),
        installationIdentityProvider: createInstallationIdentityProviderStub('install-2'),
        appVersion: '1.0.0',
      },
    )

    expect(provider.activate).toHaveBeenCalledWith({
      key: 'new-license-key',
      deviceName: 'Migrated Desktop',
      device: {
        machineId: 'machine-2',
        installationId: 'install-2',
        fingerprintVersion: 'machine-v1',
        appId: config.appName,
        appVersion: '1.0.0',
      },
    })
    expect(result.success).toBe(true)
    expect(settings.licensingCache).toMatchObject({
      activationToken: 'token-2',
      activationId: 'activation-2',
      machineId: 'machine-2',
      installationId: 'install-2',
      activeLicenseKey: 'new-license-key',
    })
  })

  it('keeps explicit reauthorization unavailable when device binding is disabled', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'false',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = createLicensingCacheState({
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      activeLicenseKey: 'license-key',
    })
    const settingsStore = createSettingsStoreStub(settings)

    const result = await requestLicenseReauthorization({
      config,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-2'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-1'),
    })

    expect(result).toEqual({
      available: false,
      required: false,
      activated: false,
      hasStoredActivation: false,
      machineMismatch: false,
      installationMismatch: false,
      reasonCode: 'none',
    })
  })
})

function createLicensingCacheState(overrides?: Partial<LicensingCache>) {
  return {
    licensingCache: {
      ...createBaseLicensingCache(),
      ...overrides,
    },
  }
}

function createBaseLicensingCache(): LicensingCache {
  return {
    activationToken: null,
    activationId: null,
    machineId: null,
    installationId: null,
    lastValidatedAt: null,
    graceUntil: null,
    lastKnownLicenseStatus: null,
    lastHeartbeatAt: null,
    licenseKeyHash: null,
    activeLicenseKey: null,
  }
}

function createSettingsStoreStub(settings: {
  licensingCache: LicensingCache
}): SettingsStore & { setSetting: ReturnType<typeof vi.fn> } {
  return {
    getSettings: () => ({
      language: null,
      updatePreferences: {
        autoCheck: true,
        downloadStrategy: 'manual',
      },
      licensingCache: settings.licensingCache,
      uiPreferences: {
        theme: 'system',
        density: 'comfortable',
      },
    }),
    getSetting: (key) => (key === 'licensingCache' ? settings.licensingCache : null) as never,
    setSetting: vi.fn((key, value) => {
      if (key === 'licensingCache') {
        settings.licensingCache = value as typeof settings.licensingCache
      }

      return value as never
    }),
  }
}

function createMachineIdentityProviderStub(machineId: string): MachineIdentityProvider {
  return {
    getMachineIdentity: async () => ({
      machineId,
      fingerprint: {
        machineId,
        fingerprintVersion: 'machine-v1',
        hostname: 'host-1',
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.0.0',
        attributes: {},
      },
    }),
  }
}

function createInstallationIdentityProviderStub(
  installationId: string,
): InstallationIdentityProvider {
  return {
    getInstallationId: () => installationId,
  }
}
