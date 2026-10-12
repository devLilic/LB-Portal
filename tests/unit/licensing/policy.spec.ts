import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { resolveLicensingPolicy } from '../../../src/shared/licensing/policy'

describe('licensing policy', () => {
  it('keeps server failures inside the grace period when a recent validation exists', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_GRACE_PERIOD_DAYS: '7',
    })

    const result = resolveLicensingPolicy(config, {
      now: new Date('2026-03-27T12:00:00.000Z'),
      lastSuccessfulAt: '2026-03-25T12:00:00.000Z',
      failureReason: 'server-unavailable',
    })

    expect(result.status).toBe('grace-period')
    expect(result.gracePeriod.active).toBe(true)
    expect(result.degradedMode.active).toBe(false)
  })

  it('switches server failures to degraded mode after the grace period expires', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_GRACE_PERIOD_DAYS: '3',
      APP_LICENSING_DEGRADED_MODE: 'limited',
    })

    const result = resolveLicensingPolicy(config, {
      now: new Date('2026-03-27T12:00:00.000Z'),
      lastSuccessfulAt: '2026-03-20T12:00:00.000Z',
      failureReason: 'server-unavailable',
    })

    expect(result.status).toBe('degraded')
    expect(result.gracePeriod.active).toBe(false)
    expect(result.degradedMode.active).toBe(true)
    expect(result.degradedMode.mode).toBe('limited')
  })

  it('degrades invalid licenses immediately', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
    })

    const result = resolveLicensingPolicy(config, {
      status: 'invalid',
    })

    expect(result.status).toBe('invalid')
    expect(result.gracePeriod.active).toBe(false)
    expect(result.degradedMode.active).toBe(true)
  })

  it('degrades expired licenses immediately', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
    })

    const result = resolveLicensingPolicy(config, {
      failureReason: 'expired-license',
    })

    expect(result.status).toBe('expired')
    expect(result.degradedMode.active).toBe(true)
  })

  it('degrades revoked licenses immediately', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEGRADED_MODE: 'blocked',
    })

    const result = resolveLicensingPolicy(config, {
      failureReason: 'revoked-license',
    })

    expect(result.status).toBe('revoked')
    expect(result.degradedMode.active).toBe(true)
    expect(result.degradedMode.mode).toBe('blocked')
  })
})
