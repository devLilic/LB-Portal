import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'
import { createLicensingProvider } from '../../../electron/main/modules/licensing/createLicensingProvider'
import { HttpLicensingProvider } from '../../../electron/main/modules/licensing/HttpLicensingProvider'
import { MockLicensingProvider } from '../../../electron/main/modules/licensing/MockLicensingProvider'
import { NoopLicensingProvider } from '../../../electron/main/modules/licensing/NoopLicensingProvider'

describe('licensing provider selection', () => {
  it('resolves to noop in development even when licensing is enabled', () => {
    const config = loadConfig('development', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
    })

    expect(createLicensingProvider(config)).toBeInstanceOf(NoopLicensingProvider)
  })

  it('resolves to noop in production when the feature flag is off', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'false',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
    })

    expect(createLicensingProvider(config)).toBeInstanceOf(NoopLicensingProvider)
  })

  it('resolves to the http provider in production when configured', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
    })

    expect(createLicensingProvider(config)).toBeInstanceOf(HttpLicensingProvider)
  })

  it('resolves to the mock provider in production when configured', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_PROVIDER: 'mock',
    })

    expect(createLicensingProvider(config)).toBeInstanceOf(MockLicensingProvider)
  })
})
