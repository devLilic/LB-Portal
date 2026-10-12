import { describe, expect, it } from 'vitest'

import { applyStarterInit } from '../../../scripts/init/applyStarterInit'

const packageJsonFixture = `{
  "name": "electron-vite-react",
  "version": "2.2.0",
  "description": "Electron Vite React boilerplate."
}
`

const electronBuilderFixture = `{
  "appId": "YourAppID",
  "publish": {
    "provider": "generic"
  }
}
`

const baseConfigFixture = `import type { AppConfig } from './types'

export const baseConfig: AppConfig = {
  environment: 'development',
  appName: 'Electron Starter',
  features: {
    i18n: false,
    autoUpdate: false,
    appProtection: false,
    licensing: false,
    database: false,
    logging: true,
  },
  update: {
    enabled: false,
    channel: 'latest',
  },
  i18n: {
    enabled: false,
  },
  appProtection: {
    enabled: false,
  },
  licensing: {
    enabled: false,
  },
  database: {
    enabled: false,
  },
  logging: {
    enabled: true,
    level: 'info',
  },
}
`

describe('applyStarterInit', () => {
  it('updates the starter files with init values and selected modules', () => {
    const result = applyStarterInit(
      {
        packageJson: packageJsonFixture,
        electronBuilderJson: electronBuilderFixture,
        baseConfig: baseConfigFixture,
      },
      {
        appName: 'acme-desktop',
        appId: 'com.acme.desktop',
        packageName: '@acme/desktop',
        displayName: 'Acme Desktop',
        initialEnabledModules: ['logging', 'i18n', 'database'],
      },
      {
        i18n: true,
        autoUpdate: false,
        appProtection: false,
        licensing: false,
        database: true,
        logging: true,
      },
    )

    expect(result.packageJson).toContain('"name": "@acme/desktop"')
    expect(result.packageJson).toContain('"productName": "Acme Desktop"')
    expect(result.packageJson).toContain('"description": "Acme Desktop desktop application."')
    expect(result.electronBuilderJson).toContain('"appId": "com.acme.desktop"')
    expect(result.baseConfig).toContain("appName: 'acme-desktop'")
    expect(result.baseConfig).toContain('i18n: true')
    expect(result.baseConfig).toContain('database: true')
    expect(result.baseConfig).toContain('autoUpdate: false')
    expect(result.baseConfig).toContain('update: {\n    enabled: false,')
    expect(result.baseConfig).toContain('database: {\n    enabled: true,')
  })
})
