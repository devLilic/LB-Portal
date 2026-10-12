import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { HttpLicensingClient } from '../../../electron/main/modules/licensing/HttpLicensingClient'

describe('http licensing client', () => {
  it('uses config-driven endpoints for licensing operations', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          method: init?.method ?? 'GET',
        }),
      } as Response
    })
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
      APP_LICENSING_ENDPOINT_ACTIVATE: '/v1/activate',
      APP_LICENSING_ENDPOINT_VALIDATE: '/v1/validate',
      APP_LICENSING_ENDPOINT_HEARTBEAT: '/v1/heartbeat',
      APP_LICENSING_ENDPOINT_ENTITLEMENTS: '/v1/entitlements',
    })
    const client = new HttpLicensingClient(config, fetchImpl as typeof fetch)

    const device = {
      machineId: 'machine-1',
      installationId: 'install-1',
      fingerprintVersion: 'machine-v1',
      appId: 'com.example.app',
      appVersion: '1.0.0',
    }

    await client.activateLicense({ key: 'license-key', device })
    await client.validateLicense({ key: 'license-key', device })
    await client.sendHeartbeat({ key: 'license-key', device })
    await client.getEntitlements({ key: 'license-key' })

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://licenses.example.com/v1/activate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'license-key', device }),
      }),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://licenses.example.com/v1/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'license-key', device }),
      }),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://licenses.example.com/v1/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'license-key', device }),
      }),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'https://licenses.example.com/v1/entitlements',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('uses the configured status endpoint for status requests', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          enabled: true,
          status: 'active',
          licenseStatus: 'active',
          activated: true,
          validated: true,
          lastValidatedAt: null,
          activationId: null,
          activationToken: null,
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
      } as Response
    })
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
      APP_LICENSING_ENDPOINT_STATUS: '/v1/status',
    })
    const client = new HttpLicensingClient(config, fetchImpl as typeof fetch)

    await client.getStatus()

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://licenses.example.com/v1/status',
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    )
  })
})
