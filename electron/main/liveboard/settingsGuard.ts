import type { SettingsKey, AppSettings } from '../../../src/shared/settings/types'
import type { LiveBoardSettingsDenialCode } from '../../../src/shared/ipc/contracts'
type Guard=(key:SettingsKey,value:AppSettings[SettingsKey])=>void
type Applied=(key:SettingsKey,value:AppSettings[SettingsKey])=>void
let guard:Guard=()=>{}
let applied:Applied=()=>{}

export class LiveBoardSettingsGuardError extends Error {
  constructor(readonly code:LiveBoardSettingsDenialCode,readonly sectionNames:string[],message:string){super(message);this.name='LiveBoardSettingsGuardError'}
}
export function registerLiveBoardSettingsHooks(before:Guard,after:Applied){guard=before;applied=after}
export function guardLiveBoardSetting(key:SettingsKey,value:AppSettings[SettingsKey]){guard(key,value)}
export function notifyLiveBoardSettingApplied(key:SettingsKey,value:AppSettings[SettingsKey]){applied(key,value)}
