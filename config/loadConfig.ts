import { baseConfig } from './base'
import { developmentConfig } from './development'
import { productionConfig } from './production'
import { createConfigLogger, createLogger } from '../electron/main/logging'
import type {
  AppConfig,
  AppConfigOverride,
  AppEnv,
  AppLanguage,
  AppEnvironment,
  DatabaseConfig,
  LicensingConfig,
  LoggingConfig,
  UpdateProviderConfig,
} from './types'

const DEFAULT_ENV: AppEnvironment = 'development'

export function loadConfig(
  mode = process.env.NODE_ENV,
  env: AppEnv = process.env,
): AppConfig {
  const environment = resolveEnvironment(mode, env)
  const environmentConfig = environment === 'production' ? productionConfig : developmentConfig

  const config = normalizeConfig(
    mergeConfig(
      mergeConfig(baseConfig, environmentConfig),
      readEnvOverrides(env, environment),
    ),
  )

  createConfigLogger(createLogger({ logging: config.logging }, 'config')).resolved(config)

  return config
}

function resolveEnvironment(mode: string | undefined, env: AppEnv): AppEnvironment {
  const value = env.APP_ENV ?? mode ?? DEFAULT_ENV
  return value === 'production' ? 'production' : 'development'
}

function readEnvOverrides(env: AppEnv, environment: AppEnvironment): AppConfigOverride {
  const featureI18n = parseBoolean(env.APP_FEATURE_I18N)
  const featureAutoUpdate = parseBoolean(env.APP_FEATURE_AUTO_UPDATE)
  const featureAppProtection = parseBoolean(env.APP_FEATURE_APP_PROTECTION)
  const featureLicensing = parseBoolean(env.APP_FEATURE_LICENSING)
  const featureDatabase = parseBoolean(env.APP_FEATURE_DATABASE)
  const featureLogging = parseBoolean(env.APP_FEATURE_LOGGING)
  const supportedLanguages = parseLanguages(env.APP_I18N_SUPPORTED_LANGUAGES)
  const namespaces = parseStringList(env.APP_I18N_NAMESPACES)
  const updateProvider = compactObject<Partial<UpdateProviderConfig>>({
    provider: env.APP_UPDATE_PROVIDER === 'github' ? 'github' : undefined,
    owner: env.APP_UPDATE_OWNER,
    repo: env.APP_UPDATE_REPO,
    visibility: parseUpdateVisibility(env.APP_UPDATE_VISIBILITY),
  })
  const update = compactObject<AppConfigOverride['update'] extends infer T ? Extract<T, object> : never>({
    enabled: parseBoolean(env.APP_UPDATE_ENABLED) ?? featureAutoUpdate,
    channel: env.APP_UPDATE_CHANNEL === 'latest' ? 'latest' : undefined,
    autoCheck: parseBoolean(env.APP_UPDATE_AUTO_CHECK),
    autoDownload: parseBoolean(env.APP_UPDATE_AUTO_DOWNLOAD),
    allowPrerelease: parseBoolean(env.APP_UPDATE_ALLOW_PRERELEASE),
    provider: updateProvider,
  })
  const database = compactObject<Partial<DatabaseConfig>>({
    enabled: parseBoolean(env.APP_DATABASE_ENABLED) ?? featureDatabase,
    provider: parseDatabaseProvider(env.APP_DATABASE_PROVIDER),
    orm: env.APP_DATABASE_ORM === 'drizzle' ? 'drizzle' : undefined,
    fileName: env.APP_DATABASE_FILE_NAME,
    inMemoryForTests: parseBoolean(env.APP_DATABASE_IN_MEMORY_FOR_TESTS),
  })
  const logging = compactObject<Partial<LoggingConfig>>({
    enabled: parseBoolean(env.APP_LOGGING_ENABLED) ?? featureLogging,
    level: parseLogLevel(env.APP_LOG_LEVEL),
  })
  const appProtection = compactObject<Partial<AppConfigOverride['appProtection'] extends infer T ? Extract<T, object> : never>>({
    enabled: parseBoolean(env.APP_APP_PROTECTION_ENABLED) ?? featureAppProtection,
    profile: parseAppProtectionProfile(env.APP_APP_PROTECTION_PROFILE),
    allowDevTools: parseBoolean(env.APP_APP_PROTECTION_ALLOW_DEVTOOLS),
  })

  return compactOverride({
    environment,
    appName: env.APP_NAME,
    features: compactObject({
      i18n: featureI18n,
      autoUpdate: featureAutoUpdate,
      appProtection: featureAppProtection,
      licensing: featureLicensing,
      database: featureDatabase,
      logging: featureLogging,
    }),
    update,
    i18n: compactObject({
      enabled: parseBoolean(env.APP_I18N_ENABLED) ?? featureI18n,
      defaultLanguage: parseLanguage(env.APP_I18N_DEFAULT_LANGUAGE),
      supportedLanguages,
      namespaces,
    }),
    appProtection,
    licensing: compactObject({
      enabled: parseBoolean(env.APP_LICENSING_ENABLED) ?? featureLicensing,
      deviceBinding: parseBoolean(env.APP_LICENSING_DEVICE_BINDING),
      enforceMachineMatch: parseBoolean(env.APP_LICENSING_ENFORCE_MACHINE_MATCH),
      allowGraceOnMismatch: parseBoolean(env.APP_LICENSING_ALLOW_GRACE_ON_MISMATCH),
      publicKey: parseNullableString(env.APP_LICENSING_PUBLIC_KEY),
      gracePeriodDays: parseNumber(env.APP_LICENSING_GRACE_PERIOD_DAYS),
      heartbeatIntervalMs: parseNumber(env.APP_LICENSING_HEARTBEAT_INTERVAL_MS),
      degradedMode: parseLicensingDegradedMode(env.APP_LICENSING_DEGRADED_MODE),
      provider: parseLicensingProvider(env.APP_LICENSING_PROVIDER),
      apiBaseUrl: parseNullableString(env.APP_LICENSING_API_BASE_URL),
      timeoutMs: parseNumber(env.APP_LICENSING_TIMEOUT_MS),
      endpoints: compactObject({
        status: env.APP_LICENSING_ENDPOINT_STATUS,
        activate: env.APP_LICENSING_ENDPOINT_ACTIVATE,
        validate: env.APP_LICENSING_ENDPOINT_VALIDATE,
        heartbeat: env.APP_LICENSING_ENDPOINT_HEARTBEAT,
        entitlements: env.APP_LICENSING_ENDPOINT_ENTITLEMENTS,
      }),
    }),
    database,
    logging,
  })
}

function normalizeConfig(config: AppConfig): AppConfig {
  const appProtectionEnabled =
    config.features.appProtection && (config.appProtection.enabled ?? config.features.appProtection)
  const licensingEnabled =
    config.features.licensing && (config.licensing.enabled ?? config.features.licensing)
  const deviceBindingEnabled =
    config.environment === 'production' && config.licensing.deviceBinding
  const databaseEnabled =
    config.features.database && (config.database.enabled ?? config.features.database)

  return {
    ...config,
    update: {
      ...config.update,
      enabled: config.update.enabled ?? config.features.autoUpdate,
    },
    i18n: {
      ...config.i18n,
      enabled: config.i18n.enabled ?? config.features.i18n,
    },
    appProtection: {
      ...config.appProtection,
      enabled: appProtectionEnabled,
    },
    licensing: {
      ...config.licensing,
      enabled: licensingEnabled,
      deviceBinding: deviceBindingEnabled,
      enforceMachineMatch: deviceBindingEnabled && config.licensing.enforceMachineMatch,
      allowGraceOnMismatch: deviceBindingEnabled && config.licensing.allowGraceOnMismatch,
    },
    database: {
      ...config.database,
      enabled: databaseEnabled,
    },
    logging: {
      ...config.logging,
      enabled: config.logging.enabled ?? config.features.logging,
    },
    features: {
      ...config.features,
      autoUpdate: config.update.enabled,
      i18n: config.i18n.enabled,
      appProtection: appProtectionEnabled,
      licensing: licensingEnabled,
      database: databaseEnabled,
      logging: config.logging.enabled,
    },
  }
}

function mergeConfig(base: AppConfig, override: AppConfigOverride): AppConfig {
  return {
    ...base,
    ...override,
    features: {
      ...base.features,
      ...override.features,
    },
    update: {
      ...base.update,
      ...override.update,
      provider: {
        ...base.update.provider,
        ...override.update?.provider,
      },
    },
    i18n: {
      ...base.i18n,
      ...override.i18n,
    },
    appProtection: {
      ...base.appProtection,
      ...override.appProtection,
    },
    licensing: {
      ...base.licensing,
      ...override.licensing,
      endpoints: {
        ...base.licensing.endpoints,
        ...override.licensing?.endpoints,
      },
    },
    database: {
      ...base.database,
      ...override.database,
    },
    logging: {
      ...base.logging,
      ...override.logging,
    },
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return undefined
}

function parseLanguage(value: string | undefined): AppLanguage | undefined {
  if (value === 'en' || value === 'ro' || value === 'ru') {
    return value
  }

  return undefined
}

function parseLanguages(value: string | undefined): AppLanguage[] | undefined {
  const items = parseStringList(value)

  if (!items) {
    return undefined
  }

  const languages = items
    .map(parseLanguage)
    .filter((language): language is AppLanguage => language !== undefined)

  return languages.length > 0 ? languages : undefined
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function parseNullableString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseLogLevel(value: string | undefined) {
  if (
    value === 'silent' ||
    value === 'error' ||
    value === 'warn' ||
    value === 'info' ||
    value === 'debug'
  ) {
    return value
  }

  return undefined
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseUpdateVisibility(value: string | undefined) {
  if (value === 'public' || value === 'private') {
    return value
  }

  return undefined
}

function parseAppProtectionProfile(value: string | undefined) {
  if (value === 'standard' || value === 'commercial') {
    return value
  }

  return undefined
}

function parseLicensingDegradedMode(
  value: string | undefined,
): LicensingConfig['degradedMode'] | undefined {
  if (value === 'readonly' || value === 'limited' || value === 'blocked') {
    return value
  }

  return undefined
}

function parseLicensingProvider(
  value: string | undefined,
): LicensingConfig['provider'] | undefined {
  if (value === 'noop' || value === 'mock' || value === 'http') {
    return value
  }

  return undefined
}

function parseDatabaseProvider(
  value: string | undefined,
): DatabaseConfig['provider'] | undefined {
  if (value === 'sqlite') {
    return value
  }

  return undefined
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined)
  return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : undefined
}

function compactOverride(value: AppConfigOverride): AppConfigOverride {
  return compactObject(value) ?? {}
}
