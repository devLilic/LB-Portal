import { createInstance, type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppConfig } from '../../config/types'
export {
  createI18nResources,
  fallbackLanguage,
  getFallbackLanguage,
  i18nNamespaces,
  isI18nEnabled,
  isSupportedLanguage,
  resolveLanguage,
} from './resources'
import { createI18nResources, getFallbackLanguage } from './resources'

export function createI18nInstance(config: AppConfig): I18nInstance {
  const instance = createInstance()
  const resolvedFallbackLanguage = getFallbackLanguage(config)

  instance.use(initReactI18next)
  void instance.init({
    resources: createI18nResources(),
    lng: resolvedFallbackLanguage,
    fallbackLng: resolvedFallbackLanguage,
    supportedLngs: config.i18n.supportedLanguages,
    ns: config.i18n.namespaces,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    initImmediate: false,
  })

  return instance
}
