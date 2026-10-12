import { describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../../../config/loadConfig'
import type { InstallationIdentityProvider, MachineIdentityProvider } from '../../../electron/main/modules/licensing/device-identity'
import type { LicensingProvider } from '../../../electron/main/modules/licensing/LicensingProvider'
import {
  shouldStartHeartbeatForLicenseStatus,
  validateStartupLicenseBinding,
} from '../../../electron/main/modules/licensing/validateStartupLicenseBinding'
import type { SettingsStore } from '../../../electron/main/modules/settings/settingsStore'

describe('startup licensing validation', () => {
  it('validates and refreshes local cache on the bound machine in production', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = {
      licensingCache: {
        activationToken: 'token-1',
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: '2026-03-26T12:00:00.000Z',
        graceUntil: null,
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: 'hash-1',
        activeLicenseKey: 'license-key',
      },
    }
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(async () => ({
        valid: true,
        status: 'active' as const,
        licenseStatus: 'active' as const,
        activationId: 'activation-1',
        activationToken: 'token-2',
        validatedAt: '2026-03-27T12:00:00.000Z',
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
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await validateStartupLicenseBinding({
      config,
      provider,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-1'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-1'),
      appVersion: '1.0.0',
    })

    expect(provider.validate).toHaveBeenCalledWith({
      key: 'license-key',
      lastValidatedAt: '2026-03-26T12:00:00.000Z',
      device: {
        machineId: 'machine-1',
        installationId: 'install-1',
        fingerprintVersion: 'machine-v1',
        appId: config.appName,
        appVersion: '1.0.0',
      },
    })
    expect(result).toMatchObject({
      status: 'active',
      validated: true,
      reasonCode: 'none',
    })
    expect(settings.licensingCache).toMatchObject({
      activationToken: 'token-2',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      lastValidatedAt: '2026-03-27T12:00:00.000Z',
      lastKnownLicenseStatus: 'active',
    })
    expect(shouldStartHeartbeatForLicenseStatus(result)).toBe(true)
  })

  it('blocks a copied install on a different machine without overwriting the original local binding', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
      APP_LICENSING_DEGRADED_MODE: 'readonly',
    })
    const settings = {
      licensingCache: {
        activationToken: 'token-1',
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: '2026-03-26T12:00:00.000Z',
        graceUntil: '2026-03-28T12:00:00.000Z',
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: 'hash-1',
        activeLicenseKey: 'license-key',
      },
    }
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(),
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await validateStartupLicenseBinding({
      config,
      provider,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-2'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-1'),
      appVersion: '1.0.0',
    })

    expect(provider.validate).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'degraded',
      validated: false,
      reasonCode: 'device_mismatch',
      degradedMode: {
        active: true,
        mode: 'blocked',
      },
    })
    expect(settingsStore.setSetting).not.toHaveBeenCalled()
    expect(settings.licensingCache.machineId).toBe('machine-1')
    expect(settings.licensingCache.installationId).toBe('install-1')
    expect(shouldStartHeartbeatForLicenseStatus(result)).toBe(false)
  })

  it('requires explicit reactivation when installation binding changes on the same machine', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
      APP_LICENSING_DEGRADED_MODE: 'limited',
    })
    const settings = {
      licensingCache: {
        activationToken: 'token-1',
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: '2026-03-26T12:00:00.000Z',
        graceUntil: null,
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: 'hash-1',
        activeLicenseKey: 'license-key',
      },
    }
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(),
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await validateStartupLicenseBinding({
      config,
      provider,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-1'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-2'),
      appVersion: '1.0.0',
    })

    expect(provider.validate).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'degraded',
      validated: false,
      reasonCode: 'reauthorization_required',
      degradedMode: {
        active: true,
        mode: 'limited',
      },
    })
    expect(settingsStore.setSetting).not.toHaveBeenCalled()
  })

  it('does not overwrite the original local binding when validation reports a suspicious clone response', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
      APP_LICENSING_DEGRADED_MODE: 'blocked',
    })
    const settings = {
      licensingCache: {
        activationToken: 'token-1',
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: '2026-03-26T12:00:00.000Z',
        graceUntil: '2026-03-28T12:00:00.000Z',
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: 'hash-1',
        activeLicenseKey: 'license-key',
      },
    }
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(async () => ({
        valid: false,
        status: 'degraded' as const,
        licenseStatus: 'degraded' as const,
        activationId: 'activation-2',
        activationToken: 'token-2',
        validatedAt: '2026-03-27T12:00:00.000Z',
        graceUntil: '2026-03-29T12:00:00.000Z',
        reasonCode: 'clone_suspected' as const,
        entitlements: {
          items: [],
        },
        gracePeriod: {
          active: false,
          startedAt: null,
          endsAt: null,
          remainingDays: 0,
        },
        degradedMode: {
          active: true,
          mode: 'blocked' as const,
          reason: 'Clone suspected.',
        },
      })),
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await validateStartupLicenseBinding({
      config,
      provider,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-1'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-1'),
      appVersion: '1.0.0',
    })

    expect(provider.validate).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      status: 'degraded',
      validated: false,
      reasonCode: 'clone_suspected',
      degradedMode: {
        active: true,
        mode: 'blocked',
      },
    })
    expect(settingsStore.setSetting).not.toHaveBeenCalled()
    expect(settings.licensingCache).toMatchObject({
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
    })
  })

  it('skips local anti-clone mismatch enforcement when device binding is disabled', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'false',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = {
      licensingCache: {
        activationToken: 'token-1',
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: '2026-03-26T12:00:00.000Z',
        graceUntil: null,
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: 'hash-1',
        activeLicenseKey: 'license-key',
      },
    }
    const settingsStore = createSettingsStoreStub(settings)
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(async () => ({
        valid: true,
        status: 'active' as const,
        licenseStatus: 'active' as const,
        activationId: 'activation-1',
        activationToken: 'token-2',
        validatedAt: '2026-03-27T12:00:00.000Z',
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
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    const result = await validateStartupLicenseBinding({
      config,
      provider,
      settingsStore,
      machineIdentityProvider: createMachineIdentityProviderStub('machine-2'),
      installationIdentityProvider: createInstallationIdentityProviderStub('install-2'),
      appVersion: '1.0.0',
    })

    expect(provider.validate).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      status: 'active',
      validated: true,
    })
    expect(settings.licensingCache).toMatchObject({
      machineId: 'machine-1',
      installationId: 'install-1',
      activationToken: 'token-2',
    })
  })
})

function createSettingsStoreStub(settings: {
  licensingCache: {
    activationToken: string | null
    activationId: string | null
    machineId: string | null
    installationId: string | null
    lastValidatedAt: string | null
    graceUntil: string | null
    lastKnownLicenseStatus: 'active' | 'grace-period' | 'degraded' | 'expired' | 'invalid' | 'revoked' | 'unlicensed' | null
    lastHeartbeatAt: string | null
    licenseKeyHash: string | null
    activeLicenseKey: string | null
  }
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
