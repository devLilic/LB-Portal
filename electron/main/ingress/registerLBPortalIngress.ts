import {app,ipcMain,type BrowserWindow} from 'electron'
import {ingressEventChannels,ingressInvokeChannels} from '../../../src/shared/ingress/channels'
import {liveBoardEventChannels,liveBoardInvokeChannels} from '../../../src/shared/liveboard/runtime'
import {LiveBoardController} from '../liveboard/controller'
import {defaultLiveBoardConnection} from '../../../src/shared/liveboard/connection'
import {defaultMosProjects, type MosMappingSettings} from '../../../src/shared/settings/mosProjects'
import {LBPortalReceiver} from './LBPortalReceiver'
import {createSettingsStore} from '../modules/settings/settingsStore'
import {saveSettingFromIpc} from '../modules/settings/settingsSave'
import {resolveMosMapping} from '../../../src/shared/ingress/mosMappingResolution'
import {resolveOnAirGraphic} from '../../../src/shared/onair/mappings'
import type {OnAirPlaybackRequest} from '../../../src/shared/onair/contracts'
import type {StaticProjectGraphicPlaybackRequest} from '../../../src/shared/onair/contracts'
import {onAirInvokeChannels} from '../../../src/shared/onair/contracts'
import {normalizeMosProjects} from '../../../src/shared/settings/mosProjects'
import type {MosMappingResolution} from '../../../src/shared/ingress/mosMappingResolution'
function validate(event:Electron.IpcMainInvokeEvent){const url=event.senderFrame?.url??'';if(url.startsWith('file://'))return;const dev=process.env.VITE_DEV_SERVER_URL;if(dev&&new URL(url).origin===new URL(dev).origin)return;throw Error('Untrusted renderer.')}
export function registerLBPortalIngress(getWindow:()=>BrowserWindow|null){
 const settings=createSettingsStore(app.getPath('userData'))
 let connection=defaultLiveBoardConnection,mappings:MosMappingSettings=defaultMosProjects()
 try{connection=settings.getSetting('liveBoardConnection')}catch{}
 try{mappings=settings.getSetting('mosMappings')}catch{}
 const controller=new LiveBoardController(connection,mappings,snapshot=>getWindow()?.webContents.send(liveBoardEventChannels.snapshot,snapshot))
 controller.installSettingsGuard()
 let receiver!:LBPortalReceiver
 receiver=new LBPortalReceiver(app.getPath('userData'),entry=>getWindow()?.webContents.send(ingressEventChannels.requestReceived,entry),body=>resolveMosMapping(body,settings.getSetting('mosMappings')),entry=>getWindow()?.webContents.send(ingressEventChannels.requestUpdated,entry),async entry=>{
  if(!entry.accepted||!entry.body||typeof entry.body.requestId!=='string'||typeof entry.body.template!=='string')return null
  if(entry.body.type==='mos-play'){
   const params=entry.body.params;const values=params&&typeof params==='object'&&!Array.isArray(params)?params as Record<string,unknown>:undefined
   return controller.execute({requestId:entry.body.requestId,template:entry.body.template,...(values?{params:values}:{}),...(entry.mapping?{mapping:entry.mapping}:{})},report=>receiver.updateExecution(entry.id,report))
  }
  if(entry.body.type==='mos-resume')return controller.resumeSource(entry.body.template,entry.mapping)
  return null
 },(entry,execution)=>entry.body?.type==='mos-play'&&typeof entry.body.requestId==='string'?controller.getAutomaticDurationForRequest(entry.body.requestId,execution,entry.mapping):undefined)
 ipcMain.handle(ingressInvokeChannels.getInfo,e=>{validate(e);return receiver.getInfo()});ipcMain.handle(ingressInvokeChannels.getRequests,e=>{validate(e);return receiver.getRequests()});ipcMain.handle(ingressInvokeChannels.clearRequests,e=>{validate(e);receiver.clearRequests()})
 const handle=(channel:string,fn:(...args:any[])=>unknown)=>ipcMain.handle(channel,(e,...args)=>{validate(e);return fn(...args)})
 const validId=(id:unknown):string=>{if(typeof id!=='string'||!controller.snapshot.sections.some(s=>s.sectionId===id))throw Error('Unknown MOS mapping section.');return id}
 handle(liveBoardInvokeChannels.getSnapshot,()=>controller.snapshot);handle(liveBoardInvokeChannels.connect,()=>controller.connect().then(()=>controller.snapshot));handle(liveBoardInvokeChannels.disconnect,()=>controller.disconnect().then(()=>controller.snapshot));handle(liveBoardInvokeChannels.takeOut,(id:unknown)=>controller.takeOut(validId(id)).then(()=>controller.snapshot));handle(liveBoardInvokeChannels.stop,(id:unknown)=>controller.stop(validId(id)).then(()=>controller.snapshot));handle(liveBoardInvokeChannels.resync,(id:unknown,state:unknown)=>{const sectionId=validId(id);if(!['OFF','A','B','single'].includes(String(state)))throw Error('Invalid resync state.');return controller.resync(sectionId,state as 'OFF'|'A'|'B'|'single').then(()=>controller.snapshot)})
 handle(liveBoardInvokeChannels.setActiveProject,(projectId:unknown)=>{
   if(typeof projectId!=='string')throw Error('Invalid MOS project id.')
   const current=settings.getSetting('mosMappings') as import('../../../src/shared/settings/mosProjects').MosProjectsConfig
   if(!current.projects.some(project=>project.id===projectId))return {ok:false,error:{code:'LIVEBOARD_PROJECT_NOT_FOUND',sectionNames:[]}}
   const result=saveSettingFromIpc(settings,{key:'mosMappings',value:{...current,activeProjectId:projectId}} as import('../../../src/shared/ipc/contracts').SettingsValuePayload)
   if('ok' in result&&result.ok===false)return {ok:false,error:{code:result.error.code,sectionNames:result.error.sectionNames}}
   return {ok:true,value:controller.snapshot}
 })
 ipcMain.handle(onAirInvokeChannels.playItem,async(event,raw:unknown)=>{
   validate(event)
   const request=validateOnAirPlaybackRequest(raw)
   const current=normalizeMosProjects(settings.getSetting('mosMappings'))
   const project=current.projects.find(item=>item.id===current.activeProjectId)
   if(!project)throw Error('There is no active MOS project.')
   if(request.projectId!==project.id)throw Error('OnAir item belongs to a project that is not active.')
   const resolution=resolveOnAirGraphic(request.kind,request.sourceTemplate,request.values,project)
   if(resolution.status!=='matched')throw Error(`OnAir graphic mapping is ${resolution.status}.`)
   const section=project.mappings.sections.find(item=>item.id===resolution.section.id)
   if(!section)throw Error('OnAir mapping section is unavailable in the active project.')
   const onAirMapping=project.onAirMappings?.find(item=>item.kind===request.kind&&item.sourceTemplate===resolution.sourceTemplate)
   if(!onAirMapping)throw Error('OnAir graphic mapping is unavailable in the active project.')
   const mapping:Extract<MosMappingResolution,{status:'matched'}>={
     status:'matched',template:resolution.sourceTemplate,commandType:request.action==='play'?'mos-play':'mos-resume',
     project:{id:project.id,name:project.name,kind:project.kind,mode:project.mode??(project.kind==='standalone'?'csv':'plasma')},section:resolution.section,
     targets:resolution.targets.map(target=>({id:target.id,template:target.template,fields:onAirMapping.fields.flatMap(field=>{const fields=field.targetFields[target.id]??[];return fields.length?[{param:field.id,fields:[...fields],value:target.fields[fields[0]!]??''}]:[]})})),
     exitMode:resolution.exitMode,durationSeconds:resolution.durationSeconds,
     resumePlayDelayMs:section.resumePlayDelayMs,dataPropagationDelayMs:section.dataPropagationDelayMs??250,missingParams:[],unmappedParams:[],
   }
   const report=request.action==='play'
     ?await controller.execute({requestId:`onair:${request.itemId}:${Date.now()}`,template:request.sourceTemplate,mapping,allowStandalone:true})
     :await controller.resumeSource(request.sourceTemplate,mapping,true,true)
   return {itemId:request.itemId,kind:request.kind,sourceTemplate:resolution.sourceTemplate,execution:report}
 })
 ipcMain.handle(onAirInvokeChannels.playProjectGraphic,async(event,raw:unknown)=>{
   validate(event)
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid static project graphic request.')
   const request=raw as StaticProjectGraphicPlaybackRequest
   if(typeof request.projectId!=='string'||!request.projectId||request.projectId.length>200||typeof request.graphicId!=='string'||!request.graphicId||request.graphicId.length>200)throw Error('Invalid static project graphic request.')
   if(request.action!=='play'&&request.action!=='resume')throw Error('Invalid static project graphic action.')
   const current=normalizeMosProjects(settings.getSetting('mosMappings'))
   const project=current.projects.find(item=>item.id===current.activeProjectId)
   if(!project)throw Error('There is no active MOS project.')
   if(request.projectId!==project.id)throw Error('Static graphic belongs to a project that is not active.')
   const graphic=project.staticGraphics?.find(item=>item.id===request.graphicId)
   if(!graphic)throw Error('Static graphic is unavailable in the active project.')
   const section=project.mappings.sections.find(item=>item.id===graphic.sectionId)
   if(!section)throw Error('Static graphic section is unavailable in the active project.')
   const template=`static:${graphic.id}`
   const mapping:Extract<MosMappingResolution,{status:'matched'}>={
     status:'matched',template,commandType:'mos-play',
     project:{id:project.id,name:project.name,kind:project.kind,mode:project.mode??(project.kind==='standalone'?'csv':'plasma')},
     section:{id:section.id,name:section.name},
     targets:section.targets.map(target=>({id:target.id,template:target.template,fields:graphic.fields.flatMap(field=>{const fields=field.targetFields[target.id]??[];return fields.length?[{param:field.id,fields:[...fields],value:field.value}]:[]})})),
     exitMode:graphic.exitMode,durationSeconds:graphic.durationSeconds,resumePlayDelayMs:section.resumePlayDelayMs,dataPropagationDelayMs:section.dataPropagationDelayMs??250,missingParams:[],unmappedParams:[],
   }
   const execution=request.action==='play'?await controller.execute({requestId:`static:${project.id}:${graphic.id}:${Date.now()}`,template,mapping,allowStandalone:true}):await controller.resumeSource(template,mapping,true,true)
   return {graphicId:graphic.id,execution}
 })
 app.on('before-quit',()=>{void receiver.close();controller.dispose()});void receiver.start();return receiver
}
function validateOnAirPlaybackRequest(value:unknown):OnAirPlaybackRequest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid OnAir playback request.')
 const raw=value as Record<string,unknown>
 if(typeof raw.projectId!=='string'||!raw.projectId||raw.projectId.length>200||typeof raw.itemId!=='string'||!raw.itemId||raw.itemId.length>300||typeof raw.sourceTemplate!=='string'||raw.sourceTemplate.length>500||!['titles','persons','locations','phones'].includes(String(raw.kind))||!['play','resume'].includes(String(raw.action)))throw Error('Invalid OnAir playback request.')
 if(!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values)||Object.entries(raw.values).length>20||Object.entries(raw.values).some(([key,item])=>!key||key.length>100||typeof item!=='string'||item.length>10000))throw Error('Invalid OnAir playback values.')
 return {projectId:raw.projectId,kind:raw.kind as OnAirPlaybackRequest['kind'],itemId:raw.itemId,sourceTemplate:raw.sourceTemplate,values:raw.values as Record<string,string>,action:raw.action as OnAirPlaybackRequest['action']}
}
