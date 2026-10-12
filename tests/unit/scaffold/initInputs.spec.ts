import { describe, expect, it } from 'vitest'

import {
  resolveStarterFeatureSelection,
  starterInitInputDefinitions,
  starterModuleIds,
  starterModuleOptions,
} from '../../../scripts/init'

describe('starter init inputs', () => {
  it('defines the required initialization inputs', () => {
    expect(starterInitInputDefinitions).toHaveLength(5)
    expect(starterInitInputDefinitions.map((definition) => definition.key)).toEqual([
      'appName',
      'appId',
      'packageName',
      'displayName',
      'initialEnabledModules',
    ])
  })

  it('keeps module options aligned with supported feature ids', () => {
    expect(starterModuleOptions.map((option) => option.id)).toEqual(starterModuleIds)
  })

  it('maps selected starter modules to feature flags', () => {
    expect(resolveStarterFeatureSelection(['logging', 'i18n', 'database'])).toEqual({
      i18n: true,
      autoUpdate: false,
      appProtection: false,
      licensing: false,
      database: true,
      logging: true,
    })
  })
})
