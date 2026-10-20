import type { SettingsSetResponse, SettingsValuePayload } from '../../../../src/shared/ipc/contracts'
import type { AppSettings, SettingsKey } from '../../../../src/shared/settings/types'
import type { SettingsStore } from './settingsStore'
import { guardLiveBoardSetting, LiveBoardSettingsGuardError, notifyLiveBoardSettingApplied } from '../../liveboard/settingsGuard'

export function saveSettingFromIpc(settingsStore:SettingsStore,payload:SettingsValuePayload):SettingsSetResponse {
  const key=payload.key as SettingsKey
  const value=payload.value as AppSettings[typeof key]

  try {
    guardLiveBoardSetting(key,value)
  } catch(error) {
    if(error instanceof LiveBoardSettingsGuardError) {
      return {ok:false,error:{code:error.code,sectionNames:[...error.sectionNames]}}
    }
    throw error
  }

  const saved=settingsStore.setSetting(key,value)
  notifyLiveBoardSettingApplied(key,saved)
  return {key,value:saved} as SettingsSetResponse
}
