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
 app.on('before-quit',()=>{void receiver.close();controller.dispose()});void receiver.start();return receiver
}
