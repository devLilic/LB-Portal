import { contextBridge } from 'electron'
import type { AppLanguage } from '../../../config/types'
import {
  ipcInvokeChannels,
  type SettingsSetResponse,
  type SettingsGetResponse,
} from '../../../src/shared/ipc/contracts'
import type { UpdatePreferences, UiPreferences } from '../../../src/shared/settings/types'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import type { MosProjectsConfig } from '../../../src/shared/settings/mosProjects'
import { getActiveMosProject, normalizeMosProjects, type MosMappingSettings } from '../../../src/shared/settings/mosProjects'
import type { LiveBoardConnectionSettings } from '../../../src/shared/liveboard/connection'
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
    async getMosMappings(): Promise<MosMappingConfig> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'mosMappings' })
      return getActiveMosProject(extractValue<MosMappingSettings>(response)).mappings
    },
    async getMosProjects(): Promise<MosProjectsConfig> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'mosMappings' })
      return normalizeMosProjects(extractValue<MosMappingSettings>(response))
    },
    async setMosMappings(value: MosMappingConfig): Promise<MosMappingConfig> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'mosMappings', value })
      return getActiveMosProject(extractValue<MosMappingSettings>(response)).mappings
    },
    async trySaveMosMappings(value: MosMappingConfig): Promise<SettingsSaveAttempt<MosMappingConfig>> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'mosMappings', value })
      return toMappingSaveAttempt(response)
    },
    async trySaveMosProjects(value: MosProjectsConfig): Promise<SettingsSaveAttempt<MosProjectsConfig>> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'mosMappings', value })
      const result = toSaveAttempt<MosMappingSettings>(response)
      return result.ok ? { ok: true, value: normalizeMosProjects(result.value) } : result
    },
    async getLiveBoardConnection(): Promise<LiveBoardConnectionSettings> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'liveBoardConnection' })
      return extractValue(response)
    },
    async setLiveBoardConnection(value: LiveBoardConnectionSettings): Promise<LiveBoardConnectionSettings> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'liveBoardConnection', value })
      return extractValue(response)
    },
    async trySaveLiveBoardConnection(value: LiveBoardConnectionSettings): Promise<SettingsSaveAttempt<LiveBoardConnectionSettings>> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'liveBoardConnection', value })
      return toSaveAttempt<LiveBoardConnectionSettings>(response)
    },
  })
}

type SettingsSaveAttempt<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; error: Extract<SettingsSetResponse, { ok: false }>['error'] }

function toSaveAttempt<TValue>(payload: SettingsSetResponse): SettingsSaveAttempt<TValue> {
  if ('ok' in payload) return payload
  return { ok: true, value: payload.value as TValue }
}

function toMappingSaveAttempt(payload: SettingsSetResponse): SettingsSaveAttempt<MosMappingConfig> {
  if ('ok' in payload) return payload
  return { ok: true, value: getActiveMosProject(payload.value as MosMappingSettings).mappings }
}

function extractValue<TValue>(payload: SettingsGetResponse | SettingsSetResponse): TValue {
  if ('ok' in payload) throw new Error(payload.error.code)
  return payload.value as TValue
}
