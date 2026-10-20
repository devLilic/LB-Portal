import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SettingsValuePayload } from '../../../src/shared/ipc/contracts'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { saveSettingFromIpc } from '../../../electron/main/modules/settings/settingsSave'
import { LiveBoardSettingsGuardError, registerLiveBoardSettingsHooks } from '../../../electron/main/liveboard/settingsGuard'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import { defaultMosProjects, getActiveMosProject } from '../../../src/shared/settings/mosProjects'

const directories:string[]=[]
afterEach(()=>{registerLiveBoardSettingsHooks(()=>{},()=>{});while(directories.length)rmSync(directories.pop()!,{recursive:true,force:true})})

function makeStore(){const directory=mkdtempSync(path.join(os.tmpdir(),'lb-settings-save-'));directories.push(directory);return {directory,store:createSettingsStore(directory)}}

describe('settings IPC save result',()=>{
  it('resolves expected guard denials as typed data without persisting or notifying',()=>{
    const {directory,store}=makeStore();let notified=false
    const original={version:1 as const,sections:[{id:'old',name:'Old',targets:[{id:'a',template:'LB-A'}],resumePlayDelayMs:100,sources:[{id:'src',template:'Old MOS',exitMode:'manual-resume' as const,durationSeconds:6,fields:[]}]}]}
    store.setSetting('mosMappings',original)
    const before=readFileMaybe(directory)
    registerLiveBoardSettingsHooks(()=>{throw new LiveBoardSettingsGuardError('MOS_MAPPINGS_ACTIVE',['Headlines'],'Active section')},()=>{notified=true})
    const payload={key:'mosMappings',value:{version:1 as const,sections:[]}} as SettingsValuePayload
    expect(saveSettingFromIpc(store,payload)).toEqual({ok:false,error:{code:'MOS_MAPPINGS_ACTIVE',sectionNames:['Headlines']}})
    expect(getActiveMosProject(store.getSetting('mosMappings')).mappings).toEqual(original)
    expect(readFileMaybe(directory)).toBe(before)
    expect(notified).toBe(false)
  })

  it('keeps the existing success payload and notifies only after an OFF save',()=>{
    const {store}=makeStore();let applied:unknown
    registerLiveBoardSettingsHooks(()=>{},(_key,value)=>{applied=value})
    const value={version:1 as const,sections:[]}
    expect(saveSettingFromIpc(store,{key:'mosMappings',value} as SettingsValuePayload)).toEqual({key:'mosMappings',value:defaultMosProjects(value)})
    expect(applied).toEqual(defaultMosProjects(value))
  })

  it('still rejects unexpected guard and persistence errors',()=>{
    const {store}=makeStore()
    registerLiveBoardSettingsHooks(()=>{throw new Error('unexpected')},()=>{})
    expect(()=>saveSettingFromIpc(store,{key:'language',value:'ro'} as SettingsValuePayload)).toThrow('unexpected')
    registerLiveBoardSettingsHooks(()=>{},()=>{})
    expect(()=>saveSettingFromIpc(store,{key:'mosMappings',value:{version:99,sections:[]} as unknown as SettingsValuePayload['value']} as SettingsValuePayload)).toThrow(/Invalid MOS/)
  })

  it('returns active mapping and connection denials from the real controller guard',async()=>{
    const {store}=makeStore()
    const config:MosMappingConfig={version:1,sections:[{id:'s',name:'Headlines',targets:[{id:'a',template:'LB-A'}],resumePlayDelayMs:0,sources:[{id:'src',template:'MOS',exitMode:'manual-resume',durationSeconds:6,fields:[]}]}]}
    const controller=new LiveBoardController({mode:'simulation',host:'127.0.0.1',port:null,timeoutMs:1000},config)
    controller.installSettingsGuard()
    await controller.execute({requestId:'active',template:'MOS'})
    await new Promise(resolve=>setTimeout(resolve,0))
    const changed={...config,sections:config.sections.map(s=>({...s,targets:[{id:'a',template:'LB-renamed'}]}))}
    expect(saveSettingFromIpc(store,{key:'mosMappings',value:changed} as SettingsValuePayload)).toEqual({ok:false,error:{code:'MOS_MAPPINGS_ACTIVE',sectionNames:['Headlines']}})
    const relabelled={...config,sections:config.sections.map(s=>({...s,name:'Top Story'}))}
    expect(saveSettingFromIpc(store,{key:'mosMappings',value:relabelled} as SettingsValuePayload)).toEqual({key:'mosMappings',value:defaultMosProjects(relabelled)})
    expect(saveSettingFromIpc(store,{key:'liveBoardConnection',value:{mode:'tcp',host:'localhost',port:1234,timeoutMs:1000}} as SettingsValuePayload)).toEqual({ok:false,error:{code:'LIVEBOARD_CONNECTION_ACTIVE',sectionNames:['Top Story']}})
    expect(controller.snapshot.sections[0]?.state).toBe('ON_SINGLE')
    expect(getActiveMosProject(store.getSetting('mosMappings')).mappings).toEqual(relabelled)
  })

  it('returns busy as data while an operation is in progress',async()=>{
    const {store}=makeStore()
    const config:MosMappingConfig={version:1,sections:[{id:'s',name:'Headline',targets:[{id:'a',template:'LB-A'}],resumePlayDelayMs:0,dataPropagationDelayMs:100,sources:[{id:'src',template:'MOS',exitMode:'manual-resume',durationSeconds:6,fields:[]}]}]}
    const controller=new LiveBoardController({mode:'simulation',host:'127.0.0.1',port:null,timeoutMs:1000},config)
    controller.installSettingsGuard()
    const pending=controller.execute({requestId:'busy',template:'MOS'})
    const result=saveSettingFromIpc(store,{key:'mosMappings',value:{version:1,sections:[]}} as SettingsValuePayload)
    expect(result).toEqual({ok:false,error:{code:'LIVEBOARD_BUSY',sectionNames:[]}})
    await pending
    expect(getActiveMosProject(store.getSetting('mosMappings')).mappings).toEqual({version:1,sections:[]})
  })
})

function readFileMaybe(directory:string){try{readFileSync(path.join(directory,'settings.json'));return true}catch{return false}}
