import { contextBridge } from 'electron'
import type { AppLanguage } from '../../../config/types'
import {
  ipcInvokeChannels,
  type SettingsGetResponse,
} from '../../../src/shared/ipc/contracts'
import type { UpdatePreferences, UiPreferences } from '../../../src/shared/settings/types'
import { invoke } from './shared'

export function registerSettingsApi() {
  contextBridge.exposeInMainWorld('settingsApi', {
    async getLanguage(): Promise<AppLanguage | null> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'language' })
      return extractValue(response)
    },
    async setLanguage(language: AppLanguage | null): Promise<AppLanguage | null> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'language', value: language })
      return extractValue(response)
    },
    async getUpdatePreferences(): Promise<UpdatePreferences> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'updatePreferences' })
      return extractValue(response)
    },
    async setUpdatePreferences(value: UpdatePreferences): Promise<UpdatePreferences> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'updatePreferences', value })
      return extractValue(response)
    },
    async getUiPreferences(): Promise<UiPreferences> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'uiPreferences' })
      return extractValue(response)
    },
    async setUiPreferences(value: UiPreferences): Promise<UiPreferences> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'uiPreferences', value })
      return extractValue(response)
    },
  })
}

function extractValue<TValue>(payload: SettingsGetResponse): TValue {
  return payload.value as TValue
}
