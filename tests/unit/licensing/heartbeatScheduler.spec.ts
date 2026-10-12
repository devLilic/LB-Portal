import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import {
  createHeartbeatScheduler,
  isHeartbeatSchedulerEnabled,
  resolveHeartbeatLicensingCacheUpdate,
} from '../../../electron/main/modules/licensing/heartbeatScheduler'
import type { LicensingProvider } from '../../../electron/main/modules/licensing/LicensingProvider'
import type { SettingsStore } from '../../../electron/main/modules/settings/settingsStore'

describe('heartbeat scheduler gating', () => {
  it('stays disabled in development', () => {
    const config = loadConfig('development', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })

    expect(isHeartbeatSchedulerEnabled(config)).toBe(false)
  })

  it('stays disabled when the licensing feature flag is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'false',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })

    expect(isHeartbeatSchedulerEnabled(config)).toBe(false)
  })

  it('stays disabled when the configured interval is zero', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '0',
    })

    expect(isHeartbeatSchedulerEnabled(config)).toBe(false)
  })

  it('is enabled in production when licensing and interval are configured', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })

    expect(isHeartbeatSchedulerEnabled(config)).toBe(true)
  })
})

describe('heartbeat scheduler runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('schedules periodic heartbeats and persists heartbeat timestamps', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })
    const heartbeat = vi.fn(async () => ({
      ok: true,
      status: 'active' as const,
      licenseStatus: 'active' as const,
      activationId: null,
      activationToken: null,
      heartbeatAt: '2026-03-27T12:00:01.000Z',
      graceUntil: null,
      reasonCode: 'none' as const,
      gracePeriod: {
        active: false,
        startedAt: null,
        endsAt: null,
        remainingDays: 7,
      },
      entitlements: {
        items: [],
      },
      degradedMode: {
        active: false,
        mode: 'none' as const,
        reason: null,
      },
    }))
    const settings = {
      licensingCache: {
        activationToken: null,
        activationId: 'activation-1',
        machineId: 'machine-1',
        installationId: 'install-1',
        lastValidatedAt: null,
        graceUntil: null,
        lastKnownLicenseStatus: 'active' as const,
        lastHeartbeatAt: null,
        licenseKeyHash: null,
        activeLicenseKey: 'license-key',
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
      getSetting: (key) => {
        return (key === 'licensingCache' ? settings.licensingCache : null) as never
      },
      setSetting: (key, value) => {
        if (key === 'licensingCache') {
          settings.licensingCache = value as typeof settings.licensingCache
        }

        return value as never
      },
    }
    const provider: LicensingProvider = {
      getStatus: vi.fn(),
      activate: vi.fn(),
      validate: vi.fn(),
      heartbeat,
      getEntitlements: vi.fn(),
    }

    const scheduler = createHeartbeatScheduler(config, provider, settingsStore, '1.0.0')
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)

    expect(heartbeat).toHaveBeenCalledWith({
      key: 'license-key',
      activationId: 'activation-1',
      device: {
        machineId: 'machine-1',
        installationId: 'install-1',
        fingerprintVersion: 'machine-v1',
        appId: config.appName,
        appVersion: '1.0.0',
      },
      lastHeartbeatAt: null,
    })
    expect(settings.licensingCache.lastHeartbeatAt).toBe('2026-03-27T12:00:01.000Z')
    expect(settings.licensingCache.lastValidatedAt).toBe('2026-03-27T12:00:01.000Z')

    scheduler.stop()
    vi.useRealTimers()
  })

  it('does not mutate the original local binding when heartbeat reports a suspicious clone response', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })
    const licensingCache = {
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      lastValidatedAt: '2026-03-26T12:00:00.000Z',
      graceUntil: '2026-03-28T12:00:00.000Z',
      lastKnownLicenseStatus: 'active' as const,
      lastHeartbeatAt: '2026-03-27T10:00:00.000Z',
      licenseKeyHash: 'hash-1',
      activeLicenseKey: 'license-key',
    }

    expect(
      resolveHeartbeatLicensingCacheUpdate(config, licensingCache, {
        ok: false,
        status: 'degraded',
        licenseStatus: 'degraded',
        activationId: 'activation-2',
        activationToken: 'token-2',
        heartbeatAt: '2026-03-27T12:00:01.000Z',
        graceUntil: '2026-03-29T12:00:00.000Z',
        reasonCode: 'clone_suspected',
        gracePeriod: {
          active: false,
          startedAt: null,
          endsAt: null,
          remainingDays: 0,
        },
        entitlements: {
          items: [],
        },
        degradedMode: {
          active: true,
          mode: 'blocked',
          reason: 'clone',
        },
      }),
    ).toBeNull()
  })

  it('skips anti-clone heartbeat blocking when device binding is disabled', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'false',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1000',
    })
    const licensingCache = {
      activationToken: 'token-1',
      activationId: 'activation-1',
      machineId: 'machine-1',
      installationId: 'install-1',
      lastValidatedAt: '2026-03-26T12:00:00.000Z',
      graceUntil: '2026-03-28T12:00:00.000Z',
      lastKnownLicenseStatus: 'active' as const,
      lastHeartbeatAt: '2026-03-27T10:00:00.000Z',
      licenseKeyHash: 'hash-1',
      activeLicenseKey: 'license-key',
    }

    expect(
      resolveHeartbeatLicensingCacheUpdate(config, licensingCache, {
        ok: false,
        status: 'degraded',
        licenseStatus: 'degraded',
        activationId: 'activation-2',
        activationToken: 'token-2',
        heartbeatAt: '2026-03-27T12:00:01.000Z',
        graceUntil: '2026-03-29T12:00:00.000Z',
        reasonCode: 'clone_suspected',
        gracePeriod: {
          active: false,
          startedAt: null,
          endsAt: null,
          remainingDays: 0,
        },
        entitlements: {
          items: [],
        },
        degradedMode: {
          active: true,
          mode: 'blocked',
          reason: 'clone',
        },
      }),
    ).toMatchObject({
      activationId: 'activation-2',
      activationToken: 'token-2',
      lastHeartbeatAt: '2026-03-27T12:00:01.000Z',
      lastKnownLicenseStatus: 'degraded',
    })
  })
})
