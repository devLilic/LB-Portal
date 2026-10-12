export type AppEnvironment = 'development' | 'production'
export type AppLanguage = 'en' | 'ro' | 'ru'
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

export interface FeatureConfig {
  i18n: boolean
  autoUpdate: boolean
  appProtection: boolean
  licensing: boolean
  database: boolean
  logging: boolean
}

export interface UpdateProviderConfig {
  provider: 'github'
  owner: string
  repo: string
  visibility: 'public' | 'private'
}

export interface UpdateConfig {
  enabled: boolean
  channel: 'latest'
  autoCheck: boolean
  autoDownload: boolean
  allowPrerelease: boolean
  provider: UpdateProviderConfig
}

export interface I18nConfig {
  enabled: boolean
  defaultLanguage: AppLanguage
  supportedLanguages: AppLanguage[]
  namespaces: string[]
}

export interface AppProtectionConfig {
  enabled: boolean
  profile: 'standard' | 'commercial'
  allowDevTools: boolean
}

export interface LicensingConfig {
  enabled: boolean
  deviceBinding: boolean
  enforceMachineMatch: boolean
  allowGraceOnMismatch: boolean
  publicKey: string | null
  gracePeriodDays: number
  heartbeatIntervalMs: number
  degradedMode: 'readonly' | 'limited' | 'blocked'
  provider: 'noop' | 'mock' | 'http'
  apiBaseUrl: string | null
  timeoutMs: number
  endpoints: {
    status: string
    activate: string
    validate: string
    heartbeat: string
    entitlements: string
  }
}

export interface DatabaseConfig {
  enabled: boolean
  provider: 'sqlite'
  orm: 'drizzle'
  fileName: string
  inMemoryForTests: boolean
}

export interface LoggingConfig {
  enabled: boolean
  level: LogLevel
}

export interface AppConfig {
  environment: AppEnvironment
  appName: string
  features: FeatureConfig
  update: UpdateConfig
  i18n: I18nConfig
  appProtection: AppProtectionConfig
  licensing: LicensingConfig
  database: DatabaseConfig
  logging: LoggingConfig
}

export type AppConfigOverride = Partial<{
  environment: AppEnvironment
  appName: string
  features: Partial<FeatureConfig>
  update: Omit<Partial<UpdateConfig>, 'provider'> & {
    provider?: Partial<UpdateProviderConfig>
  }
  i18n: Partial<I18nConfig>
  appProtection: Partial<AppProtectionConfig>
  licensing: Omit<Partial<LicensingConfig>, 'endpoints'> & {
    endpoints?: Partial<LicensingConfig['endpoints']>
  }
  database: Partial<DatabaseConfig>
  logging: Partial<LoggingConfig>
}>

export type AppEnv = Record<string, string | undefined>
