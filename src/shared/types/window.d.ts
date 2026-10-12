import type { AppConfig } from '../../../config/types'
import type {
  AppInfoPayload,
  DatabaseQueryPayload,
  DatabaseQueryResult,
  I18nLanguagePayload,
  I18nResourcePayload,
  I18nSupportedLanguagesPayload,
  LicensingActivationPayload,
  LicensingActivationResponse,
  LicensingConfirmRebindPayload,
  LicensingConfirmRebindResponse,
  LicensingDegradedModePayload,
  LicensingEntitlementsPayload,
  LicensingReauthorizationResponse,
  LicensingStatusPayload,
} from '@/shared/ipc/contracts'
import type { LicenseEntitlementsResult } from '@/shared/licensing/contracts'
import type { UpdatePreferences, UiPreferences } from '@/shared/settings/types'
import type { ProgressInfo } from 'electron-updater'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from './update'

declare global {
  interface Window {
    appApi: {
      getConfig: () => AppConfig
      getAppInfo: () => Promise<AppInfoPayload>
      onMainProcessMessage: (listener: (message: string) => void) => () => void
      openWindow: (route: string) => Promise<void>
    }
    updateApi: {
      checkForUpdates: () => Promise<unknown>
      downloadUpdate: () => Promise<void>
      quitAndInstall: () => Promise<void>
      onStateChange: (listener: (event: UpdateStateEvent) => void) => () => void
      onAvailabilityChanged: (listener: (payload: VersionInfo) => void) => () => void
      onError: (listener: (payload: UpdateErrorPayload) => void) => () => void
      onDownloadProgress: (listener: (payload: ProgressInfo) => void) => () => void
      onDownloaded: (listener: () => void) => () => void
    }
    i18nApi: {
      getCurrentLanguage: () => Promise<I18nLanguagePayload>
      getSupportedLanguages: () => Promise<I18nSupportedLanguagesPayload>
      getResources: (payload: { language: import('../../../config/types').AppLanguage; namespaces: string[] }) => Promise<I18nResourcePayload>
      setLanguage: (payload: I18nLanguagePayload) => Promise<I18nLanguagePayload>
    }
    licensingApi: {
      getStatus: () => Promise<LicensingStatusPayload>
      getDegradedModeState: () => Promise<LicensingDegradedModePayload>
      activateLicense: (payload: LicensingActivationPayload) => Promise<LicensingActivationResponse>
      requestReauthorization: () => Promise<LicensingReauthorizationResponse>
      confirmRebind: (payload: LicensingConfirmRebindPayload) => Promise<LicensingConfirmRebindResponse>
      getEntitlements: (payload: LicensingEntitlementsPayload) => Promise<LicenseEntitlementsResult>
    }
    databaseApi: {
      query: (payload: DatabaseQueryPayload) => Promise<DatabaseQueryResult>
    }
    settingsApi: {
      getLanguage: () => Promise<import('../../../config/types').AppLanguage | null>
      setLanguage: (language: import('../../../config/types').AppLanguage | null) => Promise<import('../../../config/types').AppLanguage | null>
      getUpdatePreferences: () => Promise<UpdatePreferences>
      setUpdatePreferences: (value: UpdatePreferences) => Promise<UpdatePreferences>
      getUiPreferences: () => Promise<UiPreferences>
      setUiPreferences: (value: UiPreferences) => Promise<UiPreferences>
    }
  }
}

export {}
