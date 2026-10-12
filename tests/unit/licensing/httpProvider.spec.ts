import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { HttpLicensingProvider } from '../../../electron/main/modules/licensing/HttpLicensingProvider'
import { LicensingHttpError } from '../../../electron/main/modules/licensing/LicensingHttpError'

describe('http licensing provider policy mapping', () => {
  it('maps successful status responses through the licensing policy layer', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
    })
    const provider = new HttpLicensingProvider(config, {
      getStatus: async () => ({
        enabled: true,
        status: 'active' as const,
        licenseStatus: 'active' as const,
        activated: true,
        validated: true,
        lastValidatedAt: '2026-03-27T12:00:00.000Z',
        activationId: 'activation-1',
        activationToken: 'token-1',
        graceUntil: null,
        reasonCode: 'none' as const,
        entitlements: {
          items: [
            {
              key: 'starter.pro',
              name: 'Starter Pro',
              enabled: true,
            },
          ],
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
      }),
      activateLicense: async () => {
        throw new Error('not used')
      },
      validateLicense: async () => {
        throw new Error('not used')
      },
      sendHeartbeat: async () => {
        throw new Error('not used')
      },
      getEntitlements: async () => {
        throw new Error('not used')
      },
    } as never)

    const result = await provider.getStatus()

    expect(result.status).toBe('active')
    expect(result.validated).toBe(true)
    expect(result.gracePeriod.active).toBe(false)
    expect(result.degradedMode.active).toBe(false)
    expect(result.entitlements.items).toHaveLength(1)
  })

  it('returns grace period validation when the server is unavailable after a recent validation', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
    })
    const provider = new HttpLicensingProvider(config, {
      getStatus: async () => {
        throw new LicensingHttpError('server-unavailable', 'offline')
      },
      activateLicense: async () => {
        throw new LicensingHttpError('server-unavailable', 'offline')
      },
      validateLicense: async () => {
        throw new LicensingHttpError('server-unavailable', 'offline')
      },
      sendHeartbeat: async () => {
        throw new LicensingHttpError('server-unavailable', 'offline')
      },
      getEntitlements: async () => {
        throw new LicensingHttpError('server-unavailable', 'offline')
      },
    } as never)

    const result = await provider.validate({
      key: 'license-key',
      lastValidatedAt: '2026-03-26T12:00:00.000Z',
      device: {
        machineId: 'machine-1',
        installationId: 'install-1',
        fingerprintVersion: 'machine-v1',
        appId: 'com.example.app',
        appVersion: '1.0.0',
      },
    })

    expect(result.status).toBe('grace-period')
    expect(result.valid).toBe(true)
    expect(result.degradedMode.active).toBe(false)
  })

  it('returns revoked degraded status when the provider reports revocation', async () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_DEGRADED_MODE: 'blocked',
    })
    const provider = new HttpLicensingProvider(config, {
      getStatus: async () => {
        throw new LicensingHttpError('revoked-license', 'revoked')
      },
      activateLicense: async () => {
        throw new LicensingHttpError('revoked-license', 'revoked')
      },
      validateLicense: async () => {
        throw new LicensingHttpError('revoked-license', 'revoked')
      },
      sendHeartbeat: async () => {
        throw new LicensingHttpError('revoked-license', 'revoked')
      },
      getEntitlements: async () => {
        throw new LicensingHttpError('revoked-license', 'revoked')
      },
    } as never)

    const result = await provider.validate({
      key: 'license-key',
      lastValidatedAt: '2026-03-26T12:00:00.000Z',
      device: {
        machineId: 'machine-1',
        installationId: 'install-1',
        fingerprintVersion: 'machine-v1',
        appId: 'com.example.app',
        appVersion: '1.0.0',
      },
    })

    expect(result.status).toBe('revoked')
    expect(result.valid).toBe(false)
    expect(result.degradedMode.active).toBe(true)
    expect(result.degradedMode.mode).toBe('blocked')
  })
})
