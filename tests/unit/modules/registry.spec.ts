import { describe, expect, it, vi } from 'vitest'
import { resolveEnabledModules, registerMainModules, registerPreloadModules, resolveRendererModules } from '../../../src/shared/modules/registry'
import type { AppConfig } from '../../../config/types'
import type { MainModule, PreloadModule, RendererModule } from '../../../src/shared/modules/contracts'
import { loadConfig } from '../../../config/loadConfig'

function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  const base = loadConfig('development', {})

  return {
    ...base,
    ...overrides,
    features: {
      ...base.features,
      ...overrides?.features,
    },
    update: {
      ...base.update,
      ...overrides?.update,
      provider: {
        ...base.update.provider,
        ...overrides?.update?.provider,
      },
    },
  }
}

describe('module registry', () => {
  it('resolves enabled modules from config', () => {
    const config = createConfig({
      features: {
        ...loadConfig('development', {}).features,
        autoUpdate: true,
      },
    })

    const modules = [
      { id: 'always-on' },
      { id: 'update', isEnabled: (value: AppConfig) => value.features.autoUpdate },
      { id: 'i18n', isEnabled: (value: AppConfig) => value.features.i18n },
    ]

    expect(resolveEnabledModules(modules, config).map((module) => module.id)).toEqual([
      'always-on',
      'update',
    ])
  })

  it('registers only enabled main and preload modules', async () => {
    const config = createConfig({
      features: {
        ...loadConfig('development', {}).features,
        autoUpdate: true,
      },
    })
    const mainRegister = vi.fn()
    const preloadRegister = vi.fn()
    const disabledRegister = vi.fn()

    const mainModules: MainModule[] = [
      { id: 'core', register: mainRegister },
      { id: 'update', isEnabled: (value) => value.features.autoUpdate, register: preloadRegister },
      { id: 'i18n', isEnabled: (value) => value.features.i18n, register: disabledRegister },
    ]
    const preloadModules: PreloadModule[] = [
      { id: 'api', register: mainRegister },
      { id: 'logging', isEnabled: (value) => value.features.logging, register: preloadRegister },
      { id: 'database', isEnabled: (value) => value.features.database, register: disabledRegister },
    ]

    await registerMainModules(mainModules, {
      config,
      getMainWindow: () => null,
    })
    registerPreloadModules(preloadModules, { config })

    expect(mainRegister).toHaveBeenCalledTimes(2)
    expect(preloadRegister).toHaveBeenCalledTimes(2)
    expect(disabledRegister).not.toHaveBeenCalled()
  })

  it('resolves renderer modules conditionally', () => {
    const config = createConfig({
      features: {
        ...loadConfig('development', {}).features,
        autoUpdate: false,
        logging: true,
      },
    })

    const modules: RendererModule[] = [
      { id: 'logging', isEnabled: (value) => value.features.logging, component: () => null },
      { id: 'update', isEnabled: (value) => value.features.autoUpdate, component: () => null },
    ]

    expect(resolveRendererModules(modules, config).map((module) => module.id)).toEqual(['logging'])
  })
})
