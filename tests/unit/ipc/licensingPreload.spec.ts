import { describe, expect, it } from 'vitest'

import { toLicensingDegradedModeState } from '../../../electron/preload/modules/licensingApi'

describe('licensing preload helpers', () => {
  it('maps a licensing status snapshot to the safe degraded mode view', () => {
    expect(
      toLicensingDegradedModeState({
        enabled: true,
        status: 'degraded',
        licenseStatus: 'degraded',
        activated: true,
        validated: false,
        lastValidatedAt: '2026-03-27T12:00:00.000Z',
        activationId: 'activation-1',
        graceUntil: '2026-03-28T12:00:00.000Z',
        reasonCode: 'clone_suspected',
        entitlements: {
          items: [],
        },
        gracePeriod: {
          active: false,
          startedAt: '2026-03-27T12:00:00.000Z',
          endsAt: '2026-03-28T12:00:00.000Z',
          remainingDays: 1,
        },
        degradedMode: {
          active: true,
          mode: 'blocked',
          reason: 'Clone suspected.',
        },
      }),
    ).toEqual({
      activated: true,
      validated: false,
      status: 'degraded',
      reasonCode: 'clone_suspected',
      gracePeriod: {
        active: false,
        startedAt: '2026-03-27T12:00:00.000Z',
        endsAt: '2026-03-28T12:00:00.000Z',
        remainingDays: 1,
      },
      degradedMode: {
        active: true,
        mode: 'blocked',
        reason: 'Clone suspected.',
      },
    })
  })

  it('normalizes missing reason codes to none', () => {
    expect(
      toLicensingDegradedModeState({
        enabled: true,
        status: 'active',
        licenseStatus: 'active',
        activated: true,
        validated: true,
        lastValidatedAt: '2026-03-27T12:00:00.000Z',
        activationId: 'activation-1',
        graceUntil: null,
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
    ).toMatchObject({
      status: 'active',
      reasonCode: 'none',
      degradedMode: {
        active: false,
        mode: 'none',
      },
    })
  })
})
