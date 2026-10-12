import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../config/loadConfig'

describe('loadConfig', () => {
  it('resolves development config by default', () => {
    const config = loadConfig(undefined, {})

    expect(config.environment).toBe('development')
    expect(config.features.autoUpdate).toBe(false)
    expect(config.features.appProtection).toBe(false)
    expect(config.features.licensing).toBe(false)
    expect(config.features.database).toBe(false)
    expect(config.features.logging).toBe(true)
    expect(config.logging.level).toBe('debug')
    expect(config.licensing.gracePeriodDays).toBe(7)
    expect(config.licensing.heartbeatIntervalMs).toBe(21600000)
    expect(config.licensing.degradedMode).toBe('readonly')
    expect(config.licensing.deviceBinding).toBe(false)
    expect(config.licensing.enforceMachineMatch).toBe(false)
    expect(config.licensing.allowGraceOnMismatch).toBe(false)
    expect(config.licensing.provider).toBe('noop')
    expect(config.licensing.apiBaseUrl).toBeNull()
    expect(config.licensing.timeoutMs).toBe(5000)
    expect(config.licensing.endpoints.status).toBe('/licenses/status')
    expect(config.licensing.endpoints.activate).toBe('/licenses/activate')
    expect(config.licensing.endpoints.validate).toBe('/licenses/validate')
    expect(config.licensing.endpoints.heartbeat).toBe('/licenses/heartbeat')
    expect(config.licensing.endpoints.entitlements).toBe('/licenses/entitlements')
    expect(config.update.autoCheck).toBe(true)
    expect(config.update.autoDownload).toBe(false)
    expect(config.update.provider.visibility).toBe('public')
    expect(config.database.provider).toBe('sqlite')
    expect(config.database.orm).toBe('drizzle')
    expect(config.database.fileName).toBe('app.db')
    expect(config.database.inMemoryForTests).toBe(false)
  })

  it('resolves production config from mode', () => {
    const config = loadConfig('production', {})

    expect(config.environment).toBe('production')
    expect(config.appProtection.allowDevTools).toBe(false)
    expect(config.appProtection.enabled).toBe(false)
    expect(config.appProtection.profile).toBe('standard')
    expect(config.licensing.deviceBinding).toBe(true)
    expect(config.licensing.enforceMachineMatch).toBe(true)
    expect(config.licensing.allowGraceOnMismatch).toBe(false)
    expect(config.logging.level).toBe('info')
  })

  it('applies feature and nested env overrides', () => {
    const config = loadConfig('production', {
      APP_FEATURE_I18N: 'true',
      APP_FEATURE_AUTO_UPDATE: 'true',
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_FEATURE_DATABASE: 'true',
      APP_FEATURE_LICENSING: 'true',
      APP_UPDATE_OWNER: 'acme',
      APP_UPDATE_REPO: 'starter',
      APP_UPDATE_VISIBILITY: 'private',
      APP_UPDATE_AUTO_CHECK: 'false',
      APP_I18N_DEFAULT_LANGUAGE: 'ro',
      APP_I18N_SUPPORTED_LANGUAGES: 'en,ro',
      APP_I18N_NAMESPACES: 'common,settings',
      APP_DATABASE_PROVIDER: 'sqlite',
      APP_DATABASE_ORM: 'drizzle',
      APP_DATABASE_FILE_NAME: 'starter.sqlite',
      APP_DATABASE_IN_MEMORY_FOR_TESTS: 'true',
      APP_LOG_LEVEL: 'warn',
      APP_APP_PROTECTION_ENABLED: 'true',
      APP_APP_PROTECTION_PROFILE: 'commercial',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'true',
      APP_LICENSING_ENFORCE_MACHINE_MATCH: 'false',
      APP_LICENSING_ALLOW_GRACE_ON_MISMATCH: 'true',
      APP_LICENSING_PUBLIC_KEY: 'pk_live_123',
      APP_LICENSING_GRACE_PERIOD_DAYS: '14',
      APP_LICENSING_HEARTBEAT_INTERVAL_MS: '1800000',
      APP_LICENSING_DEGRADED_MODE: 'limited',
      APP_LICENSING_PROVIDER: 'http',
      APP_LICENSING_API_BASE_URL: 'https://licenses.example.com/',
      APP_LICENSING_TIMEOUT_MS: '9000',
      APP_LICENSING_ENDPOINT_STATUS: '/v1/license/status',
      APP_LICENSING_ENDPOINT_ACTIVATE: '/v1/license/activate',
      APP_LICENSING_ENDPOINT_VALIDATE: '/v1/license/validate',
      APP_LICENSING_ENDPOINT_HEARTBEAT: '/v1/license/heartbeat',
      APP_LICENSING_ENDPOINT_ENTITLEMENTS: '/v1/license/entitlements',
    })

    expect(config.features.i18n).toBe(true)
    expect(config.features.autoUpdate).toBe(true)
    expect(config.features.database).toBe(true)
    expect(config.update.enabled).toBe(true)
    expect(config.update.autoCheck).toBe(false)
    expect(config.update.provider.owner).toBe('acme')
    expect(config.update.provider.repo).toBe('starter')
    expect(config.update.provider.visibility).toBe('private')
    expect(config.i18n.enabled).toBe(true)
    expect(config.appProtection.enabled).toBe(true)
    expect(config.appProtection.profile).toBe('commercial')
    expect(config.i18n.defaultLanguage).toBe('ro')
    expect(config.i18n.supportedLanguages).toEqual(['en', 'ro'])
    expect(config.i18n.namespaces).toEqual(['common', 'settings'])
    expect(config.database.enabled).toBe(true)
    expect(config.database.provider).toBe('sqlite')
    expect(config.database.orm).toBe('drizzle')
    expect(config.database.fileName).toBe('starter.sqlite')
    expect(config.database.inMemoryForTests).toBe(true)
    expect(config.licensing.enabled).toBe(true)
    expect(config.licensing.deviceBinding).toBe(true)
    expect(config.licensing.enforceMachineMatch).toBe(false)
    expect(config.licensing.allowGraceOnMismatch).toBe(true)
    expect(config.licensing.publicKey).toBe('pk_live_123')
    expect(config.licensing.gracePeriodDays).toBe(14)
    expect(config.licensing.heartbeatIntervalMs).toBe(1800000)
    expect(config.licensing.degradedMode).toBe('limited')
    expect(config.licensing.provider).toBe('http')
    expect(config.licensing.apiBaseUrl).toBe('https://licenses.example.com/')
    expect(config.licensing.timeoutMs).toBe(9000)
    expect(config.licensing.endpoints.status).toBe('/v1/license/status')
    expect(config.licensing.endpoints.activate).toBe('/v1/license/activate')
    expect(config.licensing.endpoints.validate).toBe('/v1/license/validate')
    expect(config.licensing.endpoints.heartbeat).toBe('/v1/license/heartbeat')
    expect(config.licensing.endpoints.entitlements).toBe('/v1/license/entitlements')
    expect(config.logging.level).toBe('warn')
  })

  it('prefers APP_ENV over mode and supports explicit nested disables', () => {
    const config = loadConfig('development', {
      APP_ENV: 'production',
      APP_FEATURE_APP_PROTECTION: 'true',
      APP_APP_PROTECTION_ENABLED: 'false',
      APP_FEATURE_LOGGING: 'false',
      APP_LOGGING_ENABLED: 'true',
    })

    expect(config.environment).toBe('production')
    expect(config.features.appProtection).toBe(false)
    expect(config.appProtection.enabled).toBe(false)
    expect(config.appProtection.profile).toBe('standard')
    expect(config.features.logging).toBe(true)
    expect(config.logging.enabled).toBe(true)
  })

  it('disables device binding automatically in development even if env overrides request it', () => {
    const config = loadConfig('development', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'true',
      APP_LICENSING_ENFORCE_MACHINE_MATCH: 'true',
      APP_LICENSING_ALLOW_GRACE_ON_MISMATCH: 'true',
    })

    expect(config.environment).toBe('development')
    expect(config.licensing.enabled).toBe(true)
    expect(config.licensing.deviceBinding).toBe(false)
    expect(config.licensing.enforceMachineMatch).toBe(false)
    expect(config.licensing.allowGraceOnMismatch).toBe(false)
  })

  it('allows production to disable device binding explicitly', () => {
    const config = loadConfig('production', {
      APP_FEATURE_LICENSING: 'true',
      APP_LICENSING_ENABLED: 'true',
      APP_LICENSING_DEVICE_BINDING: 'false',
      APP_LICENSING_ENFORCE_MACHINE_MATCH: 'true',
      APP_LICENSING_ALLOW_GRACE_ON_MISMATCH: 'true',
    })

    expect(config.environment).toBe('production')
    expect(config.licensing.enabled).toBe(true)
    expect(config.licensing.deviceBinding).toBe(false)
    expect(config.licensing.enforceMachineMatch).toBe(false)
    expect(config.licensing.allowGraceOnMismatch).toBe(false)
  })
})
