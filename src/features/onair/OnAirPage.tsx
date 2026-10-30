import {useCallback,useEffect,useRef,useState} from 'react'
import type {CSSProperties,KeyboardEvent as ReactKeyboardEvent,ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {useTranslation} from 'react-i18next'
import type {OnAirError,OnAirGroup,OnAirProjectSummary,OnAirState} from '../../shared/onair/contracts'
import {resolveOnAirGraphic,type OnAirGraphicKind,type OnAirGraphicResolution} from '../../shared/onair/mappings'
import type {MosProject} from '../../shared/settings/mosProjects'
import type {LiveBoardSnapshot} from '../../shared/liveboard/runtime'
import './onair.css'

type Props={selectedProjectId:string|null;onSelectedProjectIdChange:(id:string|null)=>void;controlsHost:HTMLDivElement|null}
type Tab={key:string;group:OnAirGroup|null;kind:'invited'|'beta'|'other';label:string;description:string}

export default function OnAirPage({selectedProjectId,onSelectedProjectIdChange,controlsHost}:Props){
 const {t}=useTranslation('onair')
 const [projects,setProjects]=useState<OnAirProjectSummary[]>([])
 const [mosProjects,setMosProjects]=useState<MosProject[]>([])
 const [settingsError,setSettingsError]=useState(false)
 const [state,setState]=useState<OnAirState|null>(null)
 const [liveBoard,setLiveBoard]=useState<LiveBoardSnapshot|null>(null)
 const [connectionBusy,setConnectionBusy]=useState(false)
 const [connectionError,setConnectionError]=useState('')
 const [operatorPanelOpen,setOperatorPanelOpen]=useState(false)
 const [operatorPanelPosition,setOperatorPanelPosition]=useState<{top:number;right:number;maxHeight:number}|null>(null)
 const [projectActivationBusy,setProjectActivationBusy]=useState(false)
 const [projectActivationNotice,setProjectActivationNotice]=useState('')
 const [projectActivationFailed,setProjectActivationFailed]=useState(false)
 const [stopAllBusy,setStopAllBusy]=useState(false)
 const [stopAllNotice,setStopAllNotice]=useState('')
 const [stopAllFailed,setStopAllFailed]=useState(false)
 const [selectedGroupKey,setSelectedGroupKey]=useState<string|null>(null)
 const [listError,setListError]=useState(false)
 const [loading,setLoading]=useState(true)
 const [refreshing,setRefreshing]=useState(false)
 const [newItemIds,setNewItemIds]=useState<Set<string>>(()=>new Set())
 const [fadingItemIds,setFadingItemIds]=useState<Set<string>>(()=>new Set())
 const [selectedItemId,setSelectedItemId]=useState<string|null>(null)
 const newItemTimeouts=useRef(new Map<string,{fade:number;remove:number}>())
 const sequence=useRef(0)
 const mounted=useRef(false)
 const snapshotRef=useRef<OnAirState|null>(null)
 const tabRefs=useRef<Array<HTMLButtonElement|null>>([])
 const operatorButtonRef=useRef<HTMLButtonElement|null>(null)
 const operatorPanelRef=useRef<HTMLElement|null>(null)
 const activeSelection=useRef<{projectId:string;key:string}|null>(null)
 const project=projects.find(item=>item.id===selectedProjectId)??null
 const liveBoardConnection=liveBoard?.connection
 const liveBoardExecutionBusy=liveBoard?.sections.some(section=>section.busy)??false
 const changeLiveBoardConnection=async()=>{
  if(!liveBoardConnection||liveBoardExecutionBusy)return
  setConnectionBusy(true);setConnectionError('')
  try{setLiveBoard(await (liveBoardConnection.status==='connected'?window.liveBoardApi.disconnect():window.liveBoardApi.connect()))}
  catch(reason){setConnectionError(reason instanceof Error?reason.message:String(reason))}
  finally{setConnectionBusy(false)}
 }

 useEffect(()=>{
  if(!operatorPanelOpen)return
  const updatePosition=()=>{
   const rect=operatorButtonRef.current?.getBoundingClientRect()
   if(!rect)return
   const top=Math.max(8,Math.min(rect.bottom+8,window.innerHeight-220))
   setOperatorPanelPosition({top,right:Math.max(8,window.innerWidth-rect.right),maxHeight:Math.max(100,window.innerHeight-top-16)})
  }
  const onPointerDown=(event:PointerEvent)=>{
   const target=event.target as Node
   if(!operatorPanelRef.current?.contains(target)&&!operatorButtonRef.current?.contains(target))setOperatorPanelOpen(false)
  }
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOperatorPanelOpen(false);operatorButtonRef.current?.focus()}}
  updatePosition()
  window.addEventListener('resize',updatePosition)
  window.addEventListener('scroll',updatePosition,true)
  document.addEventListener('pointerdown',onPointerDown)
  document.addEventListener('keydown',onKeyDown)
  return()=>{window.removeEventListener('resize',updatePosition);window.removeEventListener('scroll',updatePosition,true);document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onKeyDown)}
 },[operatorPanelOpen])

 useEffect(()=>{
  mounted.current=true
  let live=true
  void window.onAirApi.listProjects().then(items=>{
   if(!live)return
   setProjects(items)
   const previous=items.find(item=>item.id===selectedProjectId)
   const next=previous??items.find(item=>item.folderPath)??items[0]??null
   if(next){onSelectedProjectIdChange(next.id)}else{onSelectedProjectIdChange(null);setLoading(false)}
  }).catch(()=>{if(live){setListError(true);setLoading(false)}})
  void window.settingsApi.getMosProjects().then(config=>{
   if(live)setMosProjects(config.projects)
  }).catch(()=>{if(live)setSettingsError(true)})
  return()=>{live=false;mounted.current=false;sequence.current++;clearNewItemTimeouts(newItemTimeouts.current)}
 },[])

 useEffect(()=>{
  let live=true
  const unsubscribe=window.liveBoardApi.onSnapshot(value=>{if(live)setLiveBoard(value)})
  void window.liveBoardApi.getSnapshot().then(value=>{if(live)setLiveBoard(value)}).catch(()=>{})
  return()=>{live=false;unsubscribe()}
 },[])

 const loadSnapshot=useCallback(async(projectId:string,refresh=false)=>{
  const request=++sequence.current
  setLoading(!refresh)
  if(refresh)setRefreshing(true)
  try{
   const next=refresh?await window.onAirApi.refresh(projectId):await window.onAirApi.getSnapshot(projectId)
   if(!mounted.current||request!==sequence.current||selectedProjectId!==projectId)return
   const previousSnapshot=snapshotRef.current?.projectId===projectId?snapshotRef.current.snapshot:null
   snapshotRef.current=next
   setState(next)
   if(refresh&&next.snapshot&&!next.error&&!next.busy){
    const addedIds=previousSnapshot?findNewItemIds(previousSnapshot,next.snapshot):new Set<string>()
    const visibleIds=getOnAirItemIds(next.snapshot)
    for(const [id,timers] of newItemTimeouts.current){if(!visibleIds.has(id)){window.clearTimeout(timers.fade);window.clearTimeout(timers.remove);newItemTimeouts.current.delete(id)}}
    setNewItemIds(current=>new Set([...current].filter(id=>visibleIds.has(id)).concat([...addedIds])))
    setFadingItemIds(current=>new Set([...current].filter(id=>visibleIds.has(id)&&!addedIds.has(id))))
    for(const id of addedIds){
     const previousTimers=newItemTimeouts.current.get(id)
     if(previousTimers){window.clearTimeout(previousTimers.fade);window.clearTimeout(previousTimers.remove)}
     const fade=window.setTimeout(()=>setFadingItemIds(current=>new Set(current).add(id)),4500)
     const remove=window.setTimeout(()=>{
      newItemTimeouts.current.delete(id)
      setNewItemIds(current=>removeId(current,id))
      setFadingItemIds(current=>removeId(current,id))
     },5000)
     newItemTimeouts.current.set(id,{fade,remove})
    }
   }
  }catch{
   if(!mounted.current||request!==sequence.current||selectedProjectId!==projectId)return
   setState(current=>({projectId,folderPath:current?.projectId===projectId?current.folderPath:project?.folderPath??null,snapshot:current?.projectId===projectId?current.snapshot:null,error:{code:'READ_FAILED'},busy:false}))
  }finally{
   if(mounted.current&&request===sequence.current){setLoading(false);setRefreshing(false)}
  }
 },[selectedProjectId,project?.folderPath])

 useEffect(()=>{
  if(!project)return
  snapshotRef.current=null
  clearNewItemTimeouts(newItemTimeouts.current)
  setState(null)
  setNewItemIds(new Set())
  setFadingItemIds(new Set())
  setSelectedGroupKey(null)
  activeSelection.current=null
  void loadSnapshot(project.id)
 },[project?.id,loadSnapshot])

 useEffect(()=>{
  if(!state?.busy||state.projectId!==selectedProjectId)return
  const timer=window.setTimeout(()=>void loadSnapshot(state.projectId),400)
  return()=>window.clearTimeout(timer)
 },[state,selectedProjectId,loadSnapshot])

 const selectProject=(id:string)=>{
  if(id===selectedProjectId)return
  setProjectActivationNotice('')
  setProjectActivationFailed(false)
  sequence.current++
  snapshotRef.current=null
  clearNewItemTimeouts(newItemTimeouts.current)
  setState(null)
  setNewItemIds(new Set())
  setFadingItemIds(new Set())
  setSelectedGroupKey(null)
  activeSelection.current=null
  onSelectedProjectIdChange(id)
 }
 const snapshot=state?.projectId===selectedProjectId?state.snapshot:null
 const folderPath=state?.projectId===selectedProjectId?state.folderPath:project?.folderPath??null
 const error=state?.projectId===selectedProjectId?state.error:null
 const busy=refreshing||!!(state?.projectId===selectedProjectId&&state.busy)
 const selectedLiveProject=liveBoard?.projects.find(item=>item.id===selectedProjectId)??null
 const activateSelectedProject=async()=>{
  if(!liveBoard||!selectedLiveProject||selectedLiveProject.id===liveBoard.activeProject.id||projectActivationBusy)return
  setProjectActivationBusy(true)
  setProjectActivationNotice('')
  setProjectActivationFailed(false)
  try{
   const result=await window.liveBoardApi.setActiveProject(selectedLiveProject.id)
   if(!result.ok){const sections=result.error.sectionNames.join(', ')||t('settings:mos.unnamed');setProjectActivationNotice(t(`settings:liveBoard.projectSwitchDenied.${result.error.code}`,{sections}));setProjectActivationFailed(true);return}
   setLiveBoard(result.value)
   setProjectActivationNotice(t('settings:liveBoard.projectActivated'))
  }catch(reason){setProjectActivationNotice(reason instanceof Error?reason.message:String(reason));setProjectActivationFailed(true)}
  finally{setProjectActivationBusy(false)}
 }
 const clearNewItemHighlight=useCallback((itemId:string)=>{
  const timers=newItemTimeouts.current.get(itemId)
  if(timers){window.clearTimeout(timers.fade);window.clearTimeout(timers.remove);newItemTimeouts.current.delete(itemId)}
  setNewItemIds(current=>removeId(current,itemId))
  setFadingItemIds(current=>removeId(current,itemId))
 },[])
 useEffect(()=>{
  const handleRefreshKey=(event:KeyboardEvent)=>{
   if(event.key!=='F5')return
   event.preventDefault()
   if(project&&folderPath&&!busy&&!loading)void loadSnapshot(project.id,true)
  }
  window.addEventListener('keydown',handleRefreshKey)
  return()=>window.removeEventListener('keydown',handleRefreshKey)
 },[project?.id,folderPath,busy,loading,loadSnapshot])
 const mosProject=mosProjects.find(item=>item.id===selectedProjectId)??null
 const stopAllAvailable=!!mosProject&&!!liveBoard&&liveBoard.activeProject.id===mosProject.id&&!liveBoardExecutionBusy&&(liveBoard.connection.mode==='simulation'||liveBoard.connection.status==='connected')
 const stopAllProjectGraphics=async()=>{
  if(!mosProject||!stopAllAvailable||stopAllBusy)return
  setStopAllBusy(true);setStopAllNotice('');setStopAllFailed(false)
  try{
   const result=await window.liveBoardApi.stopAllProjectSections(mosProject.id)
   setLiveBoard(result.snapshot)
   if(result.failedSectionIds.length){setStopAllNotice(t('staticGraphics.stopAllPartial',{count:result.failedSectionIds.length}));setStopAllFailed(true)}
   else setStopAllNotice(t('staticGraphics.stopAllDone',{count:result.stopped}))
  }catch(reason){setStopAllNotice(reason instanceof Error?reason.message:String(reason));setStopAllFailed(true)}
  finally{setStopAllBusy(false)}
 }
 const tabs=makeTabs(snapshot?.groups??[],t)
 const tabKeys=tabs.map(tab=>tab.key).join('\0')

 useEffect(()=>{
  if(!snapshot)return
  const previous=activeSelection.current
  const existing=previous?.projectId===snapshot.projectId?tabs.find(tab=>tab.key===previous.key):undefined
  const next=existing??tabs[0]
  if(next){setSelectedGroupKey(next.key);activeSelection.current={projectId:snapshot.projectId,key:next.key}}
 },[snapshot?.projectId,snapshot?.loadedAt,tabKeys])

 const activeTab=tabs.find(tab=>tab.key===selectedGroupKey)??tabs[0]
 const chooseTab=(tab:Tab)=>{
  if(!snapshot)return
  setSelectedGroupKey(tab.key)
  activeSelection.current={projectId:snapshot.projectId,key:tab.key}
 }
 const onTabKeyDown=(event:ReactKeyboardEvent<HTMLElement>,index:number)=>{
  let nextIndex:number|undefined
  if(event.key==='ArrowRight')nextIndex=(index+1)%tabs.length
  else if(event.key==='ArrowLeft')nextIndex=(index-1+tabs.length)%tabs.length
  else if(event.key==='Home')nextIndex=0
  else if(event.key==='End')nextIndex=tabs.length-1
  if(nextIndex===undefined)return
  event.preventDefault()
  const next=tabs[nextIndex]
  chooseTab(next)
  tabRefs.current[nextIndex]?.focus()
 }

 useEffect(()=>{
  if(!activeTab)return
  const items=Array.from(document.querySelectorAll<HTMLElement>('.onair-tabpanel .onair-item'))
  const item=items[0]
  setSelectedItemId(item?.dataset.onairItemId??null)
 },[activeTab?.key,snapshot?.loadedAt])

 useEffect(()=>{
  const handleListKeys=(event:KeyboardEvent)=>{
   const isVertical=event.key==='ArrowDown'||event.key==='ArrowUp'
   const isHorizontal=event.key==='ArrowRight'||event.key==='ArrowLeft'
   const isSpace=event.key===' '||event.key==='Spacebar'
   if(!isVertical&&!isHorizontal&&!isSpace)return
   const target=event.target instanceof HTMLElement?event.target:null
   if(target?.closest('input,select,textarea,button,[role="tab"],[contenteditable="true"]'))return
   if(target&&target!==document.body&&!target.closest('.onair-page'))return
   const items=Array.from(document.querySelectorAll<HTMLElement>('.onair-tabpanel .onair-item'))
   if(!items.length)return
   const focusedItem=target?.closest<HTMLElement>('.onair-item')
   const currentItem=focusedItem??items.find(item=>item.dataset.onairItemId===selectedItemId)??items[0]
   if(isVertical){
    const direction=event.key==='ArrowDown'?1:-1
    const section=currentItem.closest<HTMLElement>('.onair-list-block')
    const sectionItems=section?Array.from(section.querySelectorAll<HTMLElement>('.onair-item')):[]
    const currentIndex=sectionItems.indexOf(currentItem)
    const next=sectionItems[currentIndex+direction]
    event.preventDefault()
    if(!next)return
    setSelectedItemId(next.dataset.onairItemId??null)
    next.focus()
    return
   }
   if(isHorizontal){
    const blocks=Array.from(document.querySelectorAll<HTMLElement>('.onair-tabpanel .onair-list-block')).filter(block=>block.querySelector('.onair-item'))
    const currentBlock=currentItem.closest<HTMLElement>('.onair-list-block')
    const blockIndex=currentBlock?blocks.indexOf(currentBlock):-1
    const nextBlock=blocks[blockIndex+(event.key==='ArrowRight'?1:-1)]
    const nextItems=nextBlock?Array.from(nextBlock.querySelectorAll<HTMLElement>('.onair-item')):[]
    const next=event.key==='ArrowRight'?nextItems[0]:nextItems[nextItems.length-1]
    event.preventDefault()
    if(!next)return
    setSelectedItemId(next.dataset.onairItemId??null)
    next.focus()
    return
   }
   if(target&&target!==document.body&&!focusedItem)return
   const button=currentItem.querySelector<HTMLButtonElement>('.onair-playback')
   if(button&&!button.disabled){event.preventDefault();button.click()}
  }
  window.addEventListener('keydown',handleListKeys)
  return()=>window.removeEventListener('keydown',handleListKeys)
 },[selectedItemId])

 return <>
  {controlsHost&&createPortal(<div className="onair-nav-controls"><button className="onair-refresh" type="button" disabled={!project||!folderPath||busy||loading} aria-busy={busy} onClick={()=>project&&void loadSnapshot(project.id,true)}>{t('refresh')}</button><button ref={operatorButtonRef} type="button" className={`onair-operator-toggle${liveBoardConnection?.status==='error'||connectionError?' has-error':''}`} aria-label={t(operatorPanelOpen?'closeOperatorControls':'openOperatorControls')} title={t(operatorPanelOpen?'closeOperatorControls':'openOperatorControls')} aria-haspopup="true" aria-expanded={operatorPanelOpen} aria-controls="onair-operator-panel" onClick={()=>setOperatorPanelOpen(open=>!open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></div>,controlsHost)}
  {operatorPanelOpen&&operatorPanelPosition&&createPortal(<section ref={operatorPanelRef} id="onair-operator-panel" className="onair-operator-panel" aria-label={t('operatorControls')} style={{top:operatorPanelPosition.top,right:operatorPanelPosition.right,maxHeight:operatorPanelPosition.maxHeight} as CSSProperties}>
   <header className="onair-operator-panel-head"><strong>{t('operatorControls')}</strong><button type="button" aria-label={t('closeOperatorControls')} onClick={()=>setOperatorPanelOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
   <section className={`onair-liveboard-status ${liveBoardConnection?.mode==='simulation'?'is-simulation':liveBoardConnection?.status==='connected'?'is-connected':liveBoardConnection?.status==='error'?'is-error':'is-disconnected'}`} aria-label={t('settings:liveBoard.connectionStatus')}>
    <div className="onair-liveboard-status-copy" aria-live="polite"><span className="onair-liveboard-mode">{liveBoardConnection?.mode==='tcp'?t('settings:liveBoard.tcp'):t('settings:liveBoard.simulation')}</span><strong>{liveBoardConnection?t(`settings:liveBoard.status.${liveBoardConnection.status}`):t('settings:liveBoard.loading')}</strong>{liveBoardConnection?.mode==='tcp'&&<small>{liveBoardConnection.host}{liveBoardConnection.port?`:${liveBoardConnection.port}`:''}</small>}{liveBoardExecutionBusy&&<small>{t('settings:liveBoard.executionBusy')}</small>}</div>
    {liveBoardConnection?.mode==='tcp'&&<button type="button" className="onair-liveboard-connection-action" disabled={connectionBusy||liveBoardExecutionBusy||liveBoardConnection.status==='connecting'} onClick={()=>void changeLiveBoardConnection()}>{t(liveBoardConnection.status==='connected'?'settings:liveBoard.disconnect':'settings:liveBoard.connect')}</button>}
   </section>
   {liveBoardConnection?.status==='connected'&&liveBoardConnection.mode==='tcp'&&<p className="onair-liveboard-protocol-note">{t('settings:liveBoard.protocolAccepted')}</p>}
   {liveBoardConnection?.error&&<p className="onair-liveboard-error" role="alert">{liveBoardConnection.error}</p>}{connectionError&&<p className="onair-liveboard-error" role="alert">{connectionError}</p>}
   <label className="onair-project-picker"><span>{t('project')}</span><select value={project?.id??''} disabled={!projects.length} onChange={event=>selectProject(event.target.value)} aria-label={t('settings:mos.projects.activeProject')}>
    {projects.length===0&&<option value="">{t('noProjects')}</option>}{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   <div className="onair-operator-actions"><button className="onair-activate-project" type="button" disabled={!selectedLiveProject||!liveBoard||selectedLiveProject.id===liveBoard.activeProject.id||projectActivationBusy} onClick={()=>void activateSelectedProject()}>{t('settings:mos.projects.activate')}</button></div>
   {projectActivationNotice&&<span className={`onair-project-notice${projectActivationFailed?' is-error':''}`} role={projectActivationFailed?'alert':'status'}>{!projectActivationFailed&&<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.4 3.4 7.7-7.8"/></svg>}{projectActivationNotice}</span>}
  </section>,document.body)}
  <section className="onair-page" aria-label={t('nav')}>
  {listError?<section className="onair-empty" role="alert"><h3>{t('loadProjectsError.title')}</h3><p>{t('loadProjectsError.body')}</p></section>:!projects.length&&!loading?<section className="onair-empty"><h3>{t('noProjects')}</h3><p>{t('noProjectsBody')}</p></section>:project&&<>
   {mosProject?.mode==='plasma'?<section className="onair-empty"><h3>{t('plasmaProject.title')}</h3><p>{t('plasmaProject.body',{project:project.name})}</p></section>:!folderPath&&!mosProject?.staticGraphics?.length?<section className="onair-empty"><h3>{t('folderMissingTitle')}</h3><p>{t('folderMissingBody',{project:project.name})}</p></section>:null}
   {mosProject?.mode!=='plasma'&&error&&!(error.code==='NOT_CONFIGURED'&&!folderPath)&&<section className="onair-error" role="alert"><strong>{t(`errors.${error.code}.title`,{defaultValue:t('errors.generic.title')})}</strong><p>{t(`errors.${error.code}.body`,{defaultValue:t('errors.generic.body')})}</p>{error.file&&<code className="onair-error-file">{error.file}{error.record?` · ${t('record',{record:error.record})}`:''}</code>}{error.detail&&<p className="onair-error-detail">{t('errorDetail')}: {error.detail}</p>}</section>}
   {settingsError&&<p className="onair-settings-error" role="status">{t('mappings.settingsUnavailable')}</p>}
   {snapshot&&<section className="onair-snapshot" aria-label={t('snapshot.title')}>
    {tabs.length?<>
      <div className="onair-tabs" role="tablist" aria-label={t('groups.tablist')} onKeyDown={event=>{const button=(event.target as HTMLElement).closest('[role="tab"]');if(button){const index=Number((button as HTMLElement).dataset.tabIndex);if(Number.isInteger(index))onTabKeyDown(event,index)}}}>
       {tabs.map((tab,index)=><button ref={element=>{tabRefs.current[index]=element}} key={tab.key} id={`onair-tab-${index}`} role="tab" type="button" data-tab-index={index} aria-selected={activeTab?.key===tab.key} aria-controls="onair-tabpanel" tabIndex={activeTab?.key===tab.key?0:-1} onClick={()=>chooseTab(tab)}>{tab.label}</button>)}
      </div>
      {activeTab&&<section id="onair-tabpanel" role="tabpanel" aria-labelledby={`onair-tab-${tabs.findIndex(tab=>tab.key===activeTab.key)}`} className="onair-tabpanel" tabIndex={0} onFocusCapture={event=>{const item=(event.target as HTMLElement).closest<HTMLElement>('.onair-item');if(item)setSelectedItemId(item.dataset.onairItemId??null)}}>
       <GroupPanel key={`${snapshot.projectId}-${activeTab.key}`} group={activeTab.group} kind={activeTab.kind} description={activeTab.description} t={t} project={mosProject} projectId={selectedProjectId} liveBoard={liveBoard} newItemIds={newItemIds} fadingItemIds={fadingItemIds} selectedItemId={selectedItemId} onNewItemHandled={clearNewItemHighlight}/>
      </section>}
     </>:<section className="onair-empty"><h3>{t('empty.title')}</h3><p>{t('empty.body')}</p></section>}
   </section>}
   <section className="onair-static-graphics" aria-label={t('staticGraphics.title')}><div className="onair-static-graphics-row"><div className="onair-static-graphics-grid">{(mosProject?.staticGraphics??[]).map(graphic=><StaticGraphicItem key={graphic.id} graphic={graphic} projectId={mosProject?.id??''} liveBoard={liveBoard} t={t}/>)}</div>{stopAllNotice&&<span className={`onair-static-graphics-notice${stopAllFailed?' is-error':''}`} role={stopAllFailed?'alert':'status'} title={stopAllNotice}>{stopAllNotice}</span>}<button type="button" className="onair-stop-all" disabled={!stopAllAvailable||stopAllBusy} onClick={()=>void stopAllProjectGraphics()}>{stopAllBusy?t('staticGraphics.stoppingAll'):t('staticGraphics.stopAll')}</button></div></section>
  </>}
  </section>
 </>
}

function StaticGraphicItem({graphic,projectId,liveBoard,t}:{graphic:NonNullable<MosProject['staticGraphics']>[number];projectId:string;liveBoard:LiveBoardSnapshot|null;t:(key:string,options?:Record<string,unknown>)=>string}){
 const [sending,setSending]=useState(false)
 const runtimeSection=liveBoard?.sections.find(item=>item.sectionId===graphic.sectionId)
 const activeBuffer=runtimeSection?.buffers.find(item=>item.id===runtimeSection.activeTargetId)
 const destinations=graphic.fields.flatMap(field=>(field.targetFields[runtimeSection?.activeTargetId??'']??[]).map(name=>[name,field.value] as const))
 const expected=Object.fromEntries(destinations)
 const sameGraphic=!!activeBuffer?.fields&&runtimeSection?.sourceTemplate===`static:${graphic.id}`&&Object.keys(expected).length===Object.keys(activeBuffer.fields).length&&Object.entries(expected).every(([name,value])=>activeBuffer.fields?.[name]===value)
 const isOnAir=liveBoard?.activeProject.id===projectId&&!!runtimeSection&&['ON_A','ON_B','ON_SINGLE'].includes(runtimeSection.state)&&sameGraphic
 const action:'play'|'resume'=isOnAir?'resume':'play'
 const disableReason=!liveBoard?'runtimeLoading':liveBoard.activeProject.id!==projectId?'wrongProject':!runtimeSection?'unavailable':sending||runtimeSection.busy?'busy':runtimeSection.state==='NEEDS_RESYNC'?'needsResync':action==='resume'&&graphic.exitMode==='template-duration'?'automaticDuration':null
 const disabled=disableReason!==null
 const play=async()=>{if(disabled)return;setSending(true);try{await window.onAirApi.playProjectGraphic({projectId,graphicId:graphic.id,action})}catch{}finally{setSending(false)}}
 const hasValues=graphic.fields.length>0
 return <article className={`onair-static-graphic${isOnAir?' is-onair':''}`}>
  <header className="onair-static-graphic-heading"><h3>{graphic.name}</h3><button className={`onair-playback${sending?' is-busy':''}`} type="button" disabled={Boolean(disableReason)} onClick={()=>void play()} aria-label={t(`playback.${action}`)} title={disableReason?t(`playback.${disableReason}`):t(`playback.${action}`)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{action==='resume'?<><path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18 3v3h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="m9.5 8.5 6 3.5-6 3.5z"/></>:<path d="M8 5v14l11-7z"/>}</svg></button></header>
  {hasValues&&<dl className="onair-static-graphic-values" aria-label={t('staticGraphics.values')}>{graphic.fields.map(field=><div key={field.id}><dt>{field.label}</dt><dd>{field.value||t('emptyValue')}</dd></div>)}</dl>}
 </article>
}

function GroupPanel({group,kind,description,t,project,projectId,liveBoard,newItemIds,fadingItemIds,selectedItemId,onNewItemHandled}:{group:OnAirGroup|null;kind:Tab['kind'];description:string;t:(key:string,options?:Record<string,unknown>)=>string;project:MosProject|null;projectId:string|null;liveBoard:LiveBoardSnapshot|null;newItemIds:Set<string>;fadingItemIds:Set<string>;selectedItemId:string|null;onNewItemHandled:(itemId:string)=>void}){
 if(!group)return <section className={`onair-group onair-group-${kind}`}><p className="onair-empty-group">{t('groups.invitedEmpty')}</p></section>
 return <article className={`onair-group onair-group-${group.kind}`}>
  {group.kind!=='invited'&&<header className="onair-group-heading"><div>{group.kind==='beta'?<span className="onair-group-kind">{description||group.name||t('unnamedGroup')}</span>:<><span className="onair-group-kind">{t(`groupKinds.${group.kind}`)}</span><h3>{description||group.name||t('unnamedGroup')}</h3></>}</div><span className="onair-group-total">{group.titles.length+group.persons.length+group.locations.length+group.phones.length+group.waitTitleLocations.length}</span></header>}
  <div className="onair-group-columns">
   <section className="onair-list-block onair-titles-block"><h4>{t('sections.titles')} <small>{group.titles.length}</small></h4>{group.titles.length?group.titles.map(item=><MappedItem key={item.id} itemId={item.id} kind="titles" template={item.template} values={{Titlu:item.title,Supratitlu:item.supratitle}} project={project} projectId={projectId} liveBoard={liveBoard} t={t} isNew={newItemIds.has(item.id)} isFading={fadingItemIds.has(item.id)} selected={selectedItemId===item.id} onNewItemHandled={onNewItemHandled}><div className={`onair-title-copy${item.supratitle?' has-supertitle':''}`}><span className="onair-title-number">{item.nr}</span>{item.supratitle&&<p className="onair-supertitle">{item.supratitle}</p>}<strong>{item.title||t('emptyValue')}</strong></div></MappedItem>):<p className="onair-none">{t('none')}</p>}</section>
   <div className="onair-right-column"><section className="onair-list-block"><h4>{t('sections.persons')} <small>{group.persons.length}</small></h4>{group.persons.length?group.persons.map(item=><MappedItem key={item.id} itemId={item.id} kind="persons" template={item.template} values={{Nume:item.name,Functie:item.role}} project={project} projectId={projectId} liveBoard={liveBoard} t={t} isNew={newItemIds.has(item.id)} isFading={fadingItemIds.has(item.id)} selected={selectedItemId===item.id} onNewItemHandled={onNewItemHandled}><div><strong className="onair-preserved-text">{item.name||t('emptyValue')}</strong>{item.role&&<p className="onair-secondary-text">{item.role}</p>}</div></MappedItem>):<p className="onair-none">{t('none')}</p>}</section>
  {(group.locations.length>0||group.phones.length>0||group.waitTitleLocations.length>0)&&<div className="onair-group-extra">
   {group.locations.length>0&&<section className="onair-list-block"><h4>{t('sections.locations')} <small>{group.locations.length}</small></h4>{group.locations.map(item=><MappedItem key={item.id} itemId={item.id} kind="locations" template={item.template} values={{Locatie:item.location}} project={project} projectId={projectId} liveBoard={liveBoard} t={t} isNew={newItemIds.has(item.id)} isFading={fadingItemIds.has(item.id)} selected={selectedItemId===item.id} onNewItemHandled={onNewItemHandled}><p className="onair-preserved-text">{item.location||t('emptyValue')}</p></MappedItem>)}</section>}
   {group.phones.length>0&&<section className="onair-list-block"><h4>{t('sections.phones')} <small>{group.phones.length}</small></h4>{group.phones.map(item=><MappedItem key={item.id} itemId={item.id} kind="phones" template={item.template} values={{Nume:item.name,Functie:item.role,Image:item.imagePath}} project={project} projectId={projectId} liveBoard={liveBoard} t={t} isNew={newItemIds.has(item.id)} isFading={fadingItemIds.has(item.id)} selected={selectedItemId===item.id} onNewItemHandled={onNewItemHandled}><div><strong className="onair-preserved-text">{item.name||t('emptyValue')}</strong>{item.role&&<p className="onair-secondary-text">{item.role}</p>}{item.imagePath&&<p className="onair-image-path"><span>{t('imagePath')}</span><code>{item.imagePath}</code></p>}</div></MappedItem>)}</section>}
   {group.waitTitleLocations.length>0&&<section className="onair-list-block"><h4>{t('sections.waitTitleLocations')} <small>{group.waitTitleLocations.length}</small></h4>{group.waitTitleLocations.map(item=><MappedItem key={item.id} itemId={item.id} kind="waitTitlesLocations" template={item.template} values={{Titlu:item.title,Locatie:item.location}} project={project} projectId={projectId} liveBoard={liveBoard} t={t} isNew={newItemIds.has(item.id)} isFading={fadingItemIds.has(item.id)} selected={selectedItemId===item.id} onNewItemHandled={onNewItemHandled}><div><strong className="onair-preserved-text">{item.title||t('emptyValue')}</strong><p className="onair-secondary-text">{item.location||t('emptyValue')}</p></div></MappedItem>)}</section>}
  </div>}
   </div>
  </div>
 </article>
}

function MappedItem({itemId,kind,template,values,project,projectId,liveBoard,t,children,isNew=false,isFading=false,selected=false,onNewItemHandled}:{itemId:string;kind:OnAirGraphicKind;template:string;values:Record<string,string>;project:MosProject|null;projectId:string|null;liveBoard:LiveBoardSnapshot|null;t:(key:string,options?:Record<string,unknown>)=>string;children:ReactNode;isNew?:boolean;isFading?:boolean;selected?:boolean;onNewItemHandled:(itemId:string)=>void}){
 const [sending,setSending]=useState(false)
 const [playbackResult,setPlaybackResult]=useState<'failed'|'queued'|'completed'|null>(null)
 const hasCsvTemplate=typeof template==='string'&&Boolean(template.trim())
 const resolution:OnAirGraphicResolution|undefined=project?resolveOnAirGraphic(kind,template,values,project):undefined
 const section=resolution?.status==='matched'?liveBoard?.sections.find(candidate=>candidate.sectionId===resolution.section.id):undefined
 const runtimeFields=section?.buffers.find(buffer=>buffer.id===section.activeTargetId)?.fields
 const expectedFields=resolution?.status==='matched'?resolution.targets.find(target=>target.id===section?.activeTargetId)?.fields:undefined
 const sameFields=!!runtimeFields&&!!expectedFields&&Object.keys(runtimeFields).length===Object.keys(expectedFields).length&&Object.entries(expectedFields).every(([field,value])=>runtimeFields[field]===value)
 const sameGraphic=liveBoard?.activeProject.id===projectId&&!!section&&resolution?.status==='matched'&&section.sourceTemplate===resolution.sourceTemplate&&sameFields
 const isOnAir=!!section&&['ON_A','ON_B','ON_SINGLE'].includes(section.state)&&sameGraphic
 const isSuspended=liveBoard?.activeProject.id===projectId&&section?.state==='SUSPENDED'&&sameGraphic
 const action: 'play'|'resume'=(section?.state==='ON_A'||section?.state==='ON_B'||section?.state==='ON_SINGLE')&&sameGraphic?'resume':'play'
 const disableReason=!resolution||resolution.status!=='matched'?'unavailable':!liveBoard?'runtimeLoading':liveBoard.activeProject.id!==projectId?'wrongProject':!section?'unavailable':sending||section.busy?'busy':section.state==='NEEDS_RESYNC'?'needsResync':action==='resume'&&section.exitMode==='template-duration'?'automaticDuration':null
 const playItem=async()=>{
  if(!projectId||!resolution||resolution.status!=='matched'||disableReason)return
  setSending(true)
  setPlaybackResult(null)
  try{const result=await window.onAirApi.playItem({projectId,kind,itemId,sourceTemplate:resolution.sourceTemplate,values,action});const failed=result.execution.status==='failed'||result.execution.status==='blocked';setPlaybackResult(failed?'failed':result.execution.status==='queued'||result.execution.status==='running'?'queued':'completed');if(!failed)onNewItemHandled(itemId)}
  catch{setPlaybackResult('failed')}
  finally{setSending(false)}
 }
 const playbackLabel=sending?t('playback.playing'):t(`playback.${action}`)
 const playbackTitle=disableReason?t(`playback.${disableReason}`):playbackResult?t(`playback.${playbackResult}`):playbackLabel
  const templateLabel=hasCsvTemplate?template:t('mappings.templateMissing')
  return <div className={`onair-item${isOnAir?' is-onair':''}${isSuspended?' is-suspended':''}${isNew?' is-new':''}${isFading?' is-fading':''}${selected?' is-selected':''}`} data-onair-item-id={itemId} role="group" tabIndex={0} aria-keyshortcuts="ArrowUp ArrowDown Space"><div className="onair-item-heading"><div className="onair-item-copy">{children}</div><div className="onair-item-actions">{isSuspended&&<span className="onair-suspended-badge">{t('playback.suspended')}</span>}<button className={`onair-playback${sending?' is-busy':''}`} type="button" disabled={Boolean(disableReason)} onClick={()=>void playItem()} aria-label={playbackLabel} title={playbackTitle} tabIndex={-1}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{action==='resume'?<><path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18 3v3h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="m9.5 8.5 6 3.5-6 3.5z"/></>:<path d="M8 5v14l11-7z"/>}</svg></button><span className={`onair-template${hasCsvTemplate?'':' onair-template-missing'}`} title={hasCsvTemplate?template:t('mappings.templateMissing')}>{templateLabel}</span></div></div>
 </div>
}

function makeTabs(groups:OnAirGroup[],t:(key:string,options?:Record<string,unknown>)=>string):Tab[]{
 const invited=groups.filter(group=>group.kind==='invited')
 const ordered=[...invited,...groups.filter(group=>group.kind==='beta'),...groups.filter(group=>group.kind!=='invited'&&group.kind!=='beta')]
 if(!invited.length){ordered.unshift({id:'__onair-empty-invited__',name:'',kind:'invited',titles:[],persons:[],locations:[],phones:[],waitTitleLocations:[]})}
 const betaNumber=new Map<OnAirGroup,string>()
 let betaIndex=0
 for(const group of ordered){if(group.kind==='beta'){betaIndex++;const explicit=group.name.match(/^beta\s*(\d+)/i);betaNumber.set(group,explicit?explicit[1]:String(betaIndex))}}
 const labelCounts=new Map<string,number>()
 return ordered.map(group=>{
  const label=group.id==='__onair-empty-invited__'?t('groups.invited'):group.kind==='invited'?t('groups.invited'):group.kind==='beta'?`${t('groupKinds.beta')} ${betaNumber.get(group)}`:group.name||t(`groupKinds.${group.kind}`)
  const description=group.name
  const duplicateCount=(labelCounts.get(label)??0)+1;labelCounts.set(label,duplicateCount)
  const disambiguated=duplicateCount>1?`${label} (${duplicateCount})`:label
  return {key:group.id,group:group.id==='__onair-empty-invited__'?null:group,kind:group.kind==='beta'?'beta':group.kind==='invited'?'invited':'other',label:disambiguated,description}
 })
}

function findNewItemIds(previous:OnAirState['snapshot'],next:NonNullable<OnAirState['snapshot']>):Set<string>{
 const priorCounts=new Map<string,number>()
 const fingerprint=(kind:string,group:OnAirGroup,item:object)=>JSON.stringify([kind,group.name,group.kind,...Object.entries(item).filter(([key])=>key!=='id'&&key!=='source').sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value)])
 for(const group of previous?.groups??[]){
  for(const item of group.titles)increment(priorCounts,fingerprint('titles',group,item))
  for(const item of group.persons)increment(priorCounts,fingerprint('persons',group,item))
  for(const item of group.locations)increment(priorCounts,fingerprint('locations',group,item))
  for(const item of group.phones)increment(priorCounts,fingerprint('phones',group,item))
  for(const item of group.waitTitleLocations)increment(priorCounts,fingerprint('waitTitlesLocations',group,item))
 }
 const newIds=new Set<string>()
 for(const group of next.groups){
  for(const [kind,items] of [['titles',group.titles],['persons',group.persons],['locations',group.locations],['phones',group.phones],['waitTitlesLocations',group.waitTitleLocations]] as const){
   for(const item of items){
    const key=fingerprint(kind,group,item)
    const count=priorCounts.get(key)??0
    if(count>0)priorCounts.set(key,count-1)
    else newIds.add(item.id)
   }
  }
 }
 return newIds
}
function getOnAirItemIds(snapshot:NonNullable<OnAirState['snapshot']>):Set<string>{
 const ids=new Set<string>()
 for(const group of snapshot.groups)for(const items of [group.titles,group.persons,group.locations,group.phones,group.waitTitleLocations])for(const item of items)ids.add(item.id)
 return ids
}
function removeId(current:Set<string>,id:string):Set<string>{if(!current.has(id))return current;const next=new Set(current);next.delete(id);return next}
function clearNewItemTimeouts(timers:Map<string,{fade:number;remove:number}>){for(const value of timers.values()){window.clearTimeout(value.fade);window.clearTimeout(value.remove)}timers.clear()}
function increment(counts:Map<string,number>,key:string){counts.set(key,(counts.get(key)??0)+1)}
