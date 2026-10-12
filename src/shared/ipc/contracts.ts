import type { ProgressInfo } from 'electron-updater'
import type { AppConfig, AppLanguage } from '../../../config/types'
import type {
  LicenseActivationResult,
  LicenseEntitlementsRequest,
  LicenseEntitlementsResult,
  LicenseReauthorizationSummary,
  LicenseStatusSnapshot,
} from '../licensing/contracts'
import type { AppSettings, SettingsKey } from '../settings/types'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from '../types/update'

export const ipcInvokeChannels = {
  appGetInfo: 'app:get-info',
  appOpenWindow: 'app:open-window',
  i18nGetCurrentLanguage: 'i18n:get-current-language',
  i18nGetSupportedLanguages: 'i18n:get-supported-languages',
  i18nGetResources: 'i18n:get-resources',
  i18nSetLanguage: 'i18n:set-language',
  updateCheckForUpdates: 'update:check-for-updates',
  updateStartDownload: 'update:start-download',
  updateQuitAndInstall: 'update:quit-and-install',
  licensingGetStatus: 'licensing:get-status',
  licensingActivate: 'licensing:activate',
  licensingRequestReauthorization: 'licensing:request-reauthorization',
  licensingConfirmRebind: 'licensing:confirm-rebind',
  licensingGetEntitlements: 'licensing:get-entitlements',
  databaseQuery: 'database:query',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
} as const

export const ipcEventChannels = {
  appMainProcessMessage: 'app:main-process-message',
  updateStateChanged: 'update:state-changed',
  updateAvailabilityChanged: 'update:availability-changed',
  updateError: 'update:error',
  updateDownloadProgress: 'update:download-progress',
  updateDownloaded: 'update:downloaded',
} as const

export interface AppInfoPayload {
  appName: string
  environment: AppConfig['environment']
  version: string
}

export interface I18nResourcePayload {
  language: AppLanguage
  namespaces: Record<string, Record<string, string>>
}

export interface I18nLanguagePayload {
  language: AppLanguage
}

export interface I18nSupportedLanguagesPayload {
  languages: AppLanguage[]
}

export type LicensingStatusPayload = Omit<LicenseStatusSnapshot, 'activationToken'>
export interface LicensingDegradedModePayload {
  activated: LicensingStatusPayload['activated']
  validated: LicensingStatusPayload['validated']
  status: LicensingStatusPayload['status']
  reasonCode: NonNullable<LicensingStatusPayload['reasonCode']>
  gracePeriod: LicensingStatusPayload['gracePeriod']
  degradedMode: LicensingStatusPayload['degradedMode']
}

export interface LicensingActivationPayload {
  key: string
  deviceName?: string
}

export type LicensingActivationResponse = Omit<LicenseActivationResult, 'activationToken'>
export type LicensingReauthorizationResponse = LicenseReauthorizationSummary
export type LicensingConfirmRebindPayload = LicensingActivationPayload
export type LicensingConfirmRebindResponse = LicensingActivationResponse

export type LicensingEntitlementsPayload = LicenseEntitlementsRequest

export interface DatabaseQueryPayload {
  sql: string
  params?: unknown[]
}

export interface DatabaseQueryResult {
  rows: unknown[]
}

export type SettingsGetRequest = {
  key: SettingsKey
}

export type SettingsValuePayload = {
  [TKey in SettingsKey]: {
    key: TKey
    value: AppSettings[TKey]
  }
}[SettingsKey]

export type SettingsGetResponse = SettingsValuePayload

export interface IpcInvokeContract {
  [ipcInvokeChannels.appGetInfo]: {
    request: void
    response: AppInfoPayload
  }
  [ipcInvokeChannels.appOpenWindow]: {
    request: { route: string }
    response: void
  }
  [ipcInvokeChannels.i18nGetCurrentLanguage]: {
    request: void
    response: I18nLanguagePayload
  }
  [ipcInvokeChannels.i18nGetSupportedLanguages]: {
    request: void
    response: I18nSupportedLanguagesPayload
  }
  [ipcInvokeChannels.i18nGetResources]: {
    request: { language: AppLanguage; namespaces: string[] }
    response: I18nResourcePayload
  }
  [ipcInvokeChannels.i18nSetLanguage]: {
    request: I18nLanguagePayload
    response: void
  }
  [ipcInvokeChannels.updateCheckForUpdates]: {
    request: void
    response: unknown
  }
  [ipcInvokeChannels.updateStartDownload]: {
    request: void
    response: void
  }
  [ipcInvokeChannels.updateQuitAndInstall]: {
    request: void
    response: void
  }
  [ipcInvokeChannels.licensingGetStatus]: {
    request: void
    response: LicensingStatusPayload
  }
  [ipcInvokeChannels.licensingActivate]: {
    request: LicensingActivationPayload
    response: LicensingActivationResponse
  }
  [ipcInvokeChannels.licensingRequestReauthorization]: {
    request: void
    response: LicensingReauthorizationResponse
  }
  [ipcInvokeChannels.licensingConfirmRebind]: {
    request: LicensingConfirmRebindPayload
    response: LicensingConfirmRebindResponse
  }
  [ipcInvokeChannels.licensingGetEntitlements]: {
    request: LicensingEntitlementsPayload
    response: LicenseEntitlementsResult
  }
  [ipcInvokeChannels.databaseQuery]: {
    request: DatabaseQueryPayload
    response: DatabaseQueryResult
  }
  [ipcInvokeChannels.settingsGet]: {
    request: SettingsGetRequest
    response: SettingsGetResponse
  }
  [ipcInvokeChannels.settingsSet]: {
    request: SettingsValuePayload
    response: SettingsValuePayload
  }
}

export interface IpcEventContract {
  [ipcEventChannels.appMainProcessMessage]: string
  [ipcEventChannels.updateStateChanged]: UpdateStateEvent
  [ipcEventChannels.updateAvailabilityChanged]: VersionInfo
  [ipcEventChannels.updateError]: UpdateErrorPayload
  [ipcEventChannels.updateDownloadProgress]: ProgressInfo
  [ipcEventChannels.updateDownloaded]: void
}
