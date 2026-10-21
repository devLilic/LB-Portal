import type { Resource } from 'i18next'
import type { AppConfig, AppLanguage, I18nConfig } from '../../config/types'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'
import enSettings from './locales/en/settings.json'
import enOnAir from './locales/en/onair.json'
import enUpdater from './locales/en/updater.json'
import roCommon from './locales/ro/common.json'
import roErrors from './locales/ro/errors.json'
import roSettings from './locales/ro/settings.json'
import roOnAir from './locales/ro/onair.json'
import roUpdater from './locales/ro/updater.json'
import ruCommon from './locales/ru/common.json'
import ruErrors from './locales/ru/errors.json'
import ruSettings from './locales/ru/settings.json'
import ruOnAir from './locales/ru/onair.json'
import ruUpdater from './locales/ru/updater.json'

export const i18nNamespaces = ['common', 'settings', 'updater', 'errors', 'onair'] as const
export const fallbackLanguage: AppLanguage = 'en'

export function isI18nEnabled(config: AppConfig) {
  return config.features.i18n && config.i18n.enabled
}

export function isSupportedLanguage(
  language: string | null | undefined,
  supportedLanguages: AppLanguage[],
): language is AppLanguage {
  return !!language && supportedLanguages.includes(language as AppLanguage)
}

export function getFallbackLanguage(
  config: Pick<AppConfig, 'i18n'> | { i18n: I18nConfig },
): AppLanguage {
  return isSupportedLanguage(config.i18n.defaultLanguage, config.i18n.supportedLanguages)
    ? config.i18n.defaultLanguage
    : fallbackLanguage
}

export function resolveLanguage(
  language: string | null | undefined,
  config: Pick<AppConfig, 'i18n'> | { i18n: I18nConfig },
): AppLanguage {
  if (isSupportedLanguage(language, config.i18n.supportedLanguages)) {
    return language
  }

  return getFallbackLanguage(config)
}

export function createI18nResources(): Resource {
  return {
    en: {
      common: enCommon,
      settings: enSettings,
      onair: enOnAir,
      updater: enUpdater,
      errors: enErrors,
    },
    ro: {
      common: roCommon,
      settings: roSettings,
      onair: roOnAir,
      updater: roUpdater,
      errors: roErrors,
    },
    ru: {
      common: ruCommon,
      settings: ruSettings,
      onair: ruOnAir,
      updater: ruUpdater,
      errors: ruErrors,
    },
  }
}
