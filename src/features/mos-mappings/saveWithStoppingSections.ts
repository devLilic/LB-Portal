import type {SettingsSetResponse} from '../../shared/ipc/contracts'

const stopBeforeSaveCodes=new Set(['LIVEBOARD_BUSY','MOS_MAPPINGS_ACTIVE','LIVEBOARD_CONNECTION_ACTIVE','LIVEBOARD_PROJECT_SWITCH_ACTIVE'])
export type SettingsSaveAttempt<TValue>={ok:true;value:TValue}|{ok:false;error:Extract<SettingsSetResponse,{ok:false}>['error']}

export async function saveWithStoppingSections<TValue>(
  save:()=>Promise<SettingsSaveAttempt<TValue>>,
  sections:Array<{id:string;name:string}>,
  stop:(sectionId:string)=>Promise<unknown>,
  onStopping:(sectionNames:string[])=>void,
):Promise<SettingsSaveAttempt<TValue>>{
  let result=await save()
  if(result.ok||!stopBeforeSaveCodes.has(result.error.code))return result
  const names=result.error.sectionNames
  const targets=sections.filter(section=>names.includes(section.name))
  if(!targets.length||targets.length!==new Set(names).size)return result
  onStopping(names)
  for(const section of targets)await stop(section.id)
  result=await save()
  return result
}
