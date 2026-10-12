import { describe, expect, it } from 'vitest'
import type { SettingsGetRequest, SettingsValuePayload } from '../../../src/shared/ipc/contracts'

describe('settings contract', () => {
  it('supports the starter settings keys', () => {
    const settingsKeys: SettingsGetRequest['key'][] = [
      'language',
      'updatePreferences',
      'licensingCache',
      'uiPreferences',
    ]

    expect(settingsKeys).toEqual([
      'language',
      'updatePreferences',
      'licensingCache',
      'uiPreferences',
    ])
  })

  it('maps typed values to their matching keys', () => {
    const payloads: SettingsValuePayload[] = [
      { key: 'language', value: 'en' },
      { key: 'updatePreferences', value: { autoCheck: true, downloadStrategy: 'manual' } },
      {
        key: 'licensingCache',
        value: {
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
      },
      { key: 'uiPreferences', value: { theme: 'dark', density: 'compact' } },
    ]

    expect(payloads).toHaveLength(4)
  })
})
