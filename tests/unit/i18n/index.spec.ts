import { describe, expect, it } from 'vitest'
import {
  createI18nResources,
  getFallbackLanguage,
  i18nNamespaces,
  isI18nEnabled,
  isSupportedLanguage,
  resolveLanguage,
} from '../../../src/i18n'
import { loadConfig } from '../../../config/loadConfig'

describe('i18n base setup', () => {
  it('resolves disabled when the feature flag is off', () => {
    const config = loadConfig('development', {
      APP_FEATURE_I18N: 'false',
    })

    expect(isI18nEnabled(config)).toBe(false)
  })

  it('resolves enabled when the feature flag is on', () => {
    const config = loadConfig('production', {
      APP_FEATURE_I18N: 'true',
    })

    expect(isI18nEnabled(config)).toBe(true)
  })

  it('builds resources for the supported languages and starter namespaces', () => {
    const resources = createI18nResources()

    expect(Object.keys(resources)).toEqual(['en', 'ro', 'ru'])
    expect(resources.en).toHaveProperty('common')
    expect(resources.en).toHaveProperty('settings')
    expect(resources.en).toHaveProperty('updater')
    expect(resources.en).toHaveProperty('errors')
    expect(resources.ro).toHaveProperty('common')
    expect(resources.ro).toHaveProperty('settings')
    expect(resources.ro).toHaveProperty('updater')
    expect(resources.ro).toHaveProperty('errors')
    expect(resources.ru).toHaveProperty('common')
    expect(resources.ru).toHaveProperty('settings')
    expect(resources.ru).toHaveProperty('updater')
    expect(resources.ru).toHaveProperty('errors')
  })

  it('exposes the default starter namespace list', () => {
    expect(i18nNamespaces).toEqual(['common', 'settings', 'updater', 'errors'])
  })

  it('validates supported languages against config', () => {
    const config = loadConfig('production', {})

    expect(isSupportedLanguage('en', config.i18n.supportedLanguages)).toBe(true)
    expect(isSupportedLanguage('ro', config.i18n.supportedLanguages)).toBe(true)
    expect(isSupportedLanguage('de', config.i18n.supportedLanguages)).toBe(false)
    expect(isSupportedLanguage(undefined, config.i18n.supportedLanguages)).toBe(false)
  })

  it('resolves the current language when it is supported', () => {
    const config = loadConfig('production', {})

    expect(resolveLanguage('ru', config)).toBe('ru')
  })

  it('falls back to the configured default language when the requested language is unsupported', () => {
    const config = loadConfig('production', {})

    expect(resolveLanguage('de', config)).toBe('en')
  })

  it('falls back to english when the configured default language is not supported', () => {
    const config = loadConfig('production', {
      APP_I18N_SUPPORTED_LANGUAGES: 'ro,ru',
    })

    expect(getFallbackLanguage(config)).toBe('en')
    expect(resolveLanguage(undefined, config)).toBe('en')
  })
})
