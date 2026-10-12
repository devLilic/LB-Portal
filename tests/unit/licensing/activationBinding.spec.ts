import { describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../../../config/loadConfig'
import {
  activateLicenseWithBinding,
  sanitizeLicenseActivationResult,
} from '../../../electron/main/modules/licensing/activateLicenseWithBinding'
import type { MachineIdentityProvider } from '../../../electron/main/modules/licensing/device-identity'
import type { InstallationIdentityProvider } from '../../../electron/main/modules/licensing/device-identity'
import type { LicensingProvider } from '../../../electron/main/modules/licensing/LicensingProvider'
import type { SettingsStore } from '../../../electron/main/modules/settings/settingsStore'

describe('activation binding flow', () => {
  it('stores local binding state after a successful first activation in production', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const settings = {
      licensingCache: {
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
      },
    }
    const settingsStore: SettingsStore = {
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
      setSetting: (key, value) => {
        if (key === 'licensingCache') {
          settings.licensingCache = value as typeof settings.licensingCache
        }

        return value as never
      },
    }
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(async () => ({
        success: true,
        status: 'active' as const,
        licenseStatus: 'active' as const,
        activationId: 'activation-1',
        activationToken: 'token-1',
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
    const machineIdentityProvider: MachineIdentityProvider = {
      getMachineIdentity: async () => ({
        machineId: 'machine-1',
        fingerprint: {
          machineId: 'machine-1',
          fingerprintVersion: 'machine-v1',
          hostname: 'host-1',
          platform: 'win32',
          arch: 'x64',
          appVersion: '1.0.0',
          attributes: {},
        },
      }),
    }
    const installationIdentityProvider: InstallationIdentityProvider = {
      getInstallationId: () => 'install-1',
    }

    const result = await activateLicenseWithBinding(
      {
        key: 'license-key',
        deviceName: 'Desktop',
      },
      {
        config,
        provider,
        settingsStore,
        machineIdentityProvider,
        installationIdentityProvider,
        appVersion: '1.0.0',
      },
    )

    expect(provider.activate).toHaveBeenCalledWith({
      key: 'license-key',
      deviceName: 'Desktop',
      device: {
        machineId: 'machine-1',
        installationId: 'install-1',
        fingerprintVersion: 'machine-v1',
        appId: config.appName,
        appVersion: '1.0.0',
      },
    })
    expect(result.success).toBe(true)
    expect(settings.licensingCache).toMatchObject({
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      activeLicenseKey: 'license-key',
      lastValidatedAt: '2026-03-27T12:00:00.000Z',
      lastKnownLicenseStatus: 'active',
    })
  })

  it('does not persist binding state when activation fails', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })
    const licensingCache = {
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
    const settingsStore: SettingsStore = {
      getSettings: () => ({
        language: null,
        updatePreferences: {
          autoCheck: true,
          downloadStrategy: 'manual',
        },
        licensingCache,
        uiPreferences: {
          theme: 'system',
          density: 'comfortable',
        },
      }),
      getSetting: (key) => (key === 'licensingCache' ? licensingCache : null) as never,
      setSetting: vi.fn((_, value) => value as never),
    }
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(async () => ({
        success: false,
        status: 'invalid' as const,
        licenseStatus: 'invalid' as const,
        activationId: null,
        activationToken: null,
        activatedAt: null,
        graceUntil: null,
        reasonCode: 'invalid_license' as const,
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
          active: true,
          mode: 'readonly' as const,
          reason: 'invalid',
        },
      })),
      validate: vi.fn(),
      heartbeat: vi.fn(),
      getEntitlements: vi.fn(),
    }

    await activateLicenseWithBinding(
      { key: 'license-key' },
      {
        config,
        provider,
        settingsStore,
        machineIdentityProvider: {
          getMachineIdentity: async () => ({
            machineId: 'machine-1',
            fingerprint: {
              machineId: 'machine-1',
              fingerprintVersion: 'machine-v1',
              hostname: 'host-1',
              platform: 'win32',
              arch: 'x64',
              appVersion: '1.0.0',
              attributes: {},
            },
          }),
        },
        installationIdentityProvider: {
          getInstallationId: () => 'install-1',
        },
        appVersion: '1.0.0',
      },
    )

    expect(settingsStore.setSetting).not.toHaveBeenCalled()
  })

  it('sanitizes activation results before returning them to renderer-facing IPC', () => {
    expect(
      sanitizeLicenseActivationResult({
        success: true,
        status: 'active',
        licenseStatus: 'active',
        activationId: 'activation-1',
        activationToken: 'token-1',
        activatedAt: '2026-03-27T12:00:00.000Z',
        graceUntil: null,
        reasonCode: 'none',
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
          mode: 'none',
          reason: null,
        },
      }),
    ).not.toHaveProperty('activationToken')
  })
})
