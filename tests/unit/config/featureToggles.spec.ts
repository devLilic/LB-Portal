import { describe, expect, it } from 'vitest'
import { getEnabledFeatures, isFeatureEnabled } from '../../../config/featureToggles'
import { loadConfig } from '../../../config/loadConfig'

describe('feature toggles', () => {
  it('reports feature flags from resolved config', () => {
    const config = loadConfig('development', {
      APP_FEATURE_AUTO_UPDATE: 'true',
      APP_FEATURE_DATABASE: 'true',
      APP_FEATURE_I18N: 'false',
    })

    expect(isFeatureEnabled(config, 'autoUpdate')).toBe(true)
    expect(isFeatureEnabled(config, 'database')).toBe(true)
    expect(isFeatureEnabled(config, 'i18n')).toBe(false)
  })

  it('lists enabled features in a stable, config-defined order', () => {
    const config = loadConfig('production', {
      APP_FEATURE_I18N: 'true',
      APP_FEATURE_DATABASE: 'true',
      APP_FEATURE_LOGGING: 'false',
    })

    expect(getEnabledFeatures(config)).toEqual([
      'i18n',
      'database',
    ])
  })
})
