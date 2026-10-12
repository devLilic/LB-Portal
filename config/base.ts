import type { AppConfig } from './types'

export const baseConfig: AppConfig = {
  environment: 'development',
  appName: 'default-electron-app',
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
    autoCheck: true,
    autoDownload: false,
    allowPrerelease: false,
    provider: {
      provider: 'github',
      owner: 'YOUR_GITHUB_OWNER',
      repo: 'YOUR_RELEASE_REPO',
      visibility: 'public',
    },
  },
  i18n: {
    enabled: false,
    defaultLanguage: 'ro',
    supportedLanguages: ['en', 'ro', 'ru'],
    namespaces: ['common', 'settings', 'updater', 'errors', 'licensing'],
  },
  appProtection: {
    enabled: false,
    profile: 'standard',
    allowDevTools: true,
  },
  licensing: {
    enabled: false,
    deviceBinding: true,
    enforceMachineMatch: true,
    allowGraceOnMismatch: false,
    publicKey: null,
    gracePeriodDays: 7,
    heartbeatIntervalMs: 21600000,
    degradedMode: 'readonly',
    provider: 'noop',
    apiBaseUrl: null,
    timeoutMs: 5000,
    endpoints: {
      status: '/licenses/status',
      activate: '/licenses/activate',
      validate: '/licenses/validate',
      heartbeat: '/licenses/heartbeat',
      entitlements: '/licenses/entitlements',
    },
  },
  database: {
    enabled: false,
    provider: 'sqlite',
    orm: 'drizzle',
    fileName: 'app.db',
    inMemoryForTests: false,
  },
  logging: {
    enabled: true,
    level: 'info',
  },
}