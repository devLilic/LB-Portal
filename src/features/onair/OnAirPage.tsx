import {useCallback,useEffect,useRef,useState} from 'react'
import type {KeyboardEvent,ReactNode} from 'react'
import {useTranslation} from 'react-i18next'
import type {OnAirError,OnAirGroup,OnAirProjectSummary,OnAirState} from '../../shared/onair/contracts'
import {getOnAirEffectiveTemplate,resolveOnAirGraphic,type OnAirGraphicKind,type OnAirGraphicResolution} from '../../shared/onair/mappings'
import type {MosProject} from '../../shared/settings/mosProjects'
import './onair.css'

type Props={selectedProjectId:string|null;onSelectedProjectIdChange:(id:string|null)=>void}
type Tab={key:string;group:OnAirGroup|null;kind:'invited'|'beta'|'other';label:string;description:string}

export default function OnAirPage({selectedProjectId,onSelectedProjectIdChange}:Props){
 const {t}=useTranslation('onair')
 const [projects,setProjects]=useState<OnAirProjectSummary[]>([])
 const [mosProjects,setMosProjects]=useState<MosProject[]>([])
 const [settingsError,setSettingsError]=useState(false)
 const [settingsLoaded,setSettingsLoaded]=useState(false)
 const [state,setState]=useState<OnAirState|null>(null)
 const [selectedGroupKey,setSelectedGroupKey]=useState<string|null>(null)
 const [listError,setListError]=useState(false)
 const [loading,setLoading]=useState(true)
 const [refreshing,setRefreshing]=useState(false)
 const sequence=useRef(0)
 const mounted=useRef(false)
 const tabRefs=useRef<Array<HTMLButtonElement|null>>([])
 const activeSelection=useRef<{projectId:string;key:string}|null>(null)
 const project=projects.find(item=>item.id===selectedProjectId)??null

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
   if(live){setMosProjects(config.projects);setSettingsLoaded(true)}
  }).catch(()=>{if(live){setSettingsError(true);setSettingsLoaded(true)}})
  return()=>{live=false;mounted.current=false;sequence.current++}
 },[])

 const loadSnapshot=useCallback(async(projectId:string,refresh=false)=>{
  const request=++sequence.current
  setLoading(!refresh)
  if(refresh)setRefreshing(true)
  try{
   const next=refresh?await window.onAirApi.refresh(projectId):await window.onAirApi.getSnapshot(projectId)
   if(!mounted.current||request!==sequence.current||selectedProjectId!==projectId)return
   setState(next)
  }catch{
   if(!mounted.current||request!==sequence.current||selectedProjectId!==projectId)return
   setState(current=>({projectId,folderPath:current?.projectId===projectId?current.folderPath:project?.folderPath??null,snapshot:current?.projectId===projectId?current.snapshot:null,error:{code:'READ_FAILED'},busy:false}))
  }finally{
   if(mounted.current&&request===sequence.current){setLoading(false);setRefreshing(false)}
  }
 },[selectedProjectId,project?.folderPath])

 useEffect(()=>{
  if(!project)return
  setState(null)
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
  sequence.current++
  setState(null)
  setSelectedGroupKey(null)
  activeSelection.current=null
  onSelectedProjectIdChange(id)
 }
 const snapshot=state?.projectId===selectedProjectId?state.snapshot:null
 const folderPath=state?.projectId===selectedProjectId?state.folderPath:project?.folderPath??null
 const error=state?.projectId===selectedProjectId?state.error:null
 const busy=refreshing||!!(state?.projectId===selectedProjectId&&state.busy)
 const mosProject=mosProjects.find(item=>item.id===selectedProjectId)??null
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
 const onTabKeyDown=(event:KeyboardEvent<HTMLElement>,index:number)=>{
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

 return <section className="onair-page" aria-labelledby="onair-title">
  {project&&<aside className="onair-tools" aria-label={t('tools.label')}><button className={`onair-tool-refresh${busy?' is-busy':''}`} type="button" disabled={!folderPath||busy||loading} onClick={()=>void loadSnapshot(project.id,true)} aria-label={busy?t('refreshing'):t('tools.refresh')} title={busy?t('refreshing'):t('tools.refresh')}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.8-2L20 9M4 15l2.6 2a7 7 0 0 0 11.8-2"/></svg></button></aside>}
  <header className="onair-header"><div><p className="onair-eyebrow">{t('eyebrow')}</p><h2 id="onair-title">{t('title')}</h2><p>{t('description')}</p></div>
   <label className="onair-project-picker"><span>{t('project')}</span><select value={project?.id??''} disabled={!projects.length} onChange={event=>selectProject(event.target.value)} aria-label={t('project')}>
    {projects.length===0&&<option value="">{t('noProjects')}</option>}{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
  </header>
  {listError?<section className="onair-empty" role="alert"><h3>{t('loadProjectsError.title')}</h3><p>{t('loadProjectsError.body')}</p></section>:!projects.length&&!loading?<section className="onair-empty"><h3>{t('noProjects')}</h3><p>{t('noProjectsBody')}</p></section>:project&&<>
   <section className="onair-toolbar" aria-label={t('snapshot.title')}>
    <div className="onair-source"><span className="onair-meta-label">{t('folder')}</span><code title={folderPath??undefined}>{folderPath??t('folderMissing')}</code></div>
    <div className="onair-status">{snapshot?<><span className="onair-meta-label">{t('lastLoaded')}</span><time dateTime={snapshot.loadedAt}>{formatLoadedAt(snapshot.loadedAt)}</time></>:<span role="status">{loading?t('loading'):t('noSnapshot')}</span>}</div>
    <button className="onair-refresh" type="button" disabled={!folderPath||busy||loading} onClick={()=>void loadSnapshot(project.id,true)}>{busy?t('refreshing'):t('refresh')}</button>
   </section>
   {!folderPath?<section className="onair-empty"><h3>{t('folderMissingTitle')}</h3><p>{t('folderMissingBody',{project:project.name})}</p></section>:null}
   {error&&!(error.code==='NOT_CONFIGURED'&&!folderPath)&&<section className="onair-error" role="alert"><strong>{t(`errors.${error.code}.title`,{defaultValue:t('errors.generic.title')})}</strong><p>{t(`errors.${error.code}.body`,{defaultValue:t('errors.generic.body')})}</p>{error.file&&<code className="onair-error-file">{error.file}{error.record?` · ${t('record',{record:error.record})}`:''}</code>}{error.detail&&<p className="onair-error-detail">{t('errorDetail')}: {error.detail}</p>}</section>}
   {settingsError&&<p className="onair-settings-error" role="status">{t('mappings.settingsUnavailable')}</p>}
   {snapshot&&<section className="onair-snapshot" aria-label={t('snapshot.title')}>
    <div className="onair-counts"><span>{t('counts.groups',{count:snapshot.groups.length})}</span><span>{t('counts.titles',{count:sum(snapshot.groups,'titles')})}</span><span>{t('counts.persons',{count:sum(snapshot.groups,'persons')})}</span><span>{t('counts.locations',{count:sum(snapshot.groups,'locations')})}</span><span>{t('counts.phones',{count:sum(snapshot.groups,'phones')})}</span></div>
    {tabs.length?<>
      <div className="onair-tabs" role="tablist" aria-label={t('groups.tablist')} onKeyDown={event=>{const button=(event.target as HTMLElement).closest('[role="tab"]');if(button){const index=Number((button as HTMLElement).dataset.tabIndex);if(Number.isInteger(index))onTabKeyDown(event,index)}}}>
       {tabs.map((tab,index)=><button ref={element=>{tabRefs.current[index]=element}} key={tab.key} id={`onair-tab-${index}`} role="tab" type="button" data-tab-index={index} aria-selected={activeTab?.key===tab.key} aria-controls="onair-tabpanel" tabIndex={activeTab?.key===tab.key?0:-1} onClick={()=>chooseTab(tab)}>{tab.label}</button>)}
      </div>
      {activeTab&&<section id="onair-tabpanel" role="tabpanel" aria-labelledby={`onair-tab-${tabs.findIndex(tab=>tab.key===activeTab.key)}`} className="onair-tabpanel" tabIndex={0}>
       <GroupPanel key={`${snapshot.projectId}-${activeTab.key}`} group={activeTab.group} kind={activeTab.kind} description={activeTab.description} t={t} project={mosProject} settingsLoaded={settingsLoaded}/>
      </section>}
     </>:<section className="onair-empty"><h3>{t('empty.title')}</h3><p>{t('empty.body')}</p></section>}
   </section>}
  </>}
 </section>
}

function GroupPanel({group,kind,description,t,project,settingsLoaded}:{group:OnAirGroup|null;kind:Tab['kind'];description:string;t:(key:string,options?:Record<string,unknown>)=>string;project:MosProject|null;settingsLoaded:boolean}){
 if(!group)return <section className={`onair-group onair-group-${kind}`}><header className="onair-group-heading"><div><span className="onair-group-kind">{t('groupKinds.invited')}</span><h3>{t('groups.invited')}</h3></div><span className="onair-group-total">0</span></header><p className="onair-empty-group">{t('groups.invitedEmpty')}</p></section>
 return <article className={`onair-group onair-group-${group.kind}`}>
  <header className="onair-group-heading"><div><span className="onair-group-kind">{t(`groupKinds.${group.kind}`)}</span><h3>{description||group.name||t('unnamedGroup')}</h3></div><span className="onair-group-total">{group.titles.length+group.persons.length+group.locations.length+group.phones.length}</span></header>
  <div className="onair-group-columns">
   <section className="onair-list-block"><h4>{t('sections.titles')} <small>{group.titles.length}</small></h4>{group.titles.length?group.titles.map(item=><MappedItem key={item.id} kind="titles" template={item.template} values={{Titlu:item.title,Supratitlu:item.supratitle}} project={project} settingsLoaded={settingsLoaded} t={t}><div className={`onair-title-copy${item.supratitle?' has-supertitle':''}`}><span className="onair-title-number">{item.nr}</span>{item.supratitle&&<p className="onair-supertitle">{item.supratitle}</p>}<strong>{item.title||t('emptyValue')}</strong></div></MappedItem>):<p className="onair-none">{t('none')}</p>}</section>
   <section className="onair-list-block"><h4>{t('sections.persons')} <small>{group.persons.length}</small></h4>{group.persons.length?group.persons.map(item=><MappedItem key={item.id} kind="persons" template={item.template} values={{Nume:item.name,Functie:item.role}} project={project} settingsLoaded={settingsLoaded} t={t}><div><strong className="onair-preserved-text">{item.name||t('emptyValue')}</strong>{item.role&&<p className="onair-secondary-text">{item.role}</p>}</div></MappedItem>):<p className="onair-none">{t('none')}</p>}</section>
  </div>
  {(group.locations.length>0||group.phones.length>0)&&<div className="onair-group-extra">
   {group.locations.length>0&&<section className="onair-list-block"><h4>{t('sections.locations')} <small>{group.locations.length}</small></h4>{group.locations.map(item=><MappedItem key={item.id} kind="locations" template={item.template} values={{Locatie:item.location}} project={project} settingsLoaded={settingsLoaded} t={t}><p className="onair-preserved-text">{item.location||t('emptyValue')}</p></MappedItem>)}</section>}
   {group.phones.length>0&&<section className="onair-list-block"><h4>{t('sections.phones')} <small>{group.phones.length}</small></h4>{group.phones.map(item=><MappedItem key={item.id} kind="phones" template={item.template} values={{Nume:item.name,Functie:item.role,Image:item.imagePath}} project={project} settingsLoaded={settingsLoaded} t={t}><div><strong className="onair-preserved-text">{item.name||t('emptyValue')}</strong>{item.role&&<p className="onair-secondary-text">{item.role}</p>}{item.imagePath&&<p className="onair-image-path"><span>{t('imagePath')}</span><code>{item.imagePath}</code></p>}</div></MappedItem>)}</section>}
  </div>}
 </article>
}

function MappedItem({kind,template,values,project,t,children,settingsLoaded}:{kind:OnAirGraphicKind;template:string;values:Record<string,string>;project:MosProject|null;t:(key:string,options?:Record<string,unknown>)=>string;children:ReactNode;settingsLoaded:boolean}){
 const hasCsvTemplate=typeof template==='string'&&Boolean(template.trim())
 const effectiveTemplate=getOnAirEffectiveTemplate(kind,template,project?.onAirDefaultTemplates)
 const resolution:OnAirGraphicResolution|undefined=project?resolveOnAirGraphic(kind,template,values,project):undefined
 const templateLabel=hasCsvTemplate?template:(effectiveTemplate?t('mappings.templateImplicitBadge',{template:effectiveTemplate}):t('mappings.templateMissing'))
 return <div className="onair-item"><div className="onair-item-heading"><div className="onair-item-copy">{children}</div><span className={`onair-template${hasCsvTemplate?'':effectiveTemplate?' onair-template-implicit':' onair-template-missing'}`} title={hasCsvTemplate?template:(effectiveTemplate?t('mappings.templateImplicit',{template:effectiveTemplate}):t('mappings.templateMissing'))}>{templateLabel}</span></div>
  <details className="onair-mapping-preview"><summary>{t('mappings.preview')}</summary>
   {!project&&!settingsLoaded?<p>{t('mappings.loading')}</p>:!project?<p>{t('mappings.settingsUnavailable')}</p>:!effectiveTemplate?<p>{t('mappings.sourceMissing')}</p>:!resolution?<p>{t('mappings.settingsUnavailable')}</p>:resolution.status==='unmapped'?<p>{!hasCsvTemplate&&<span>{t('mappings.templateImplicit',{template:effectiveTemplate})} </span>}{t('mappings.unmapped')}</p>:resolution.status==='missing-template'?<p>{t('mappings.missingTemplate')}</p>:<div className="onair-resolved">{!hasCsvTemplate&&<p>{t('mappings.templateImplicit',{template:effectiveTemplate})}</p>}<p>{t('mappings.section')}: <strong>{resolution.section.name}</strong></p>{resolution.targets.map(target=><section className="onair-resolved-target" key={target.id}><strong>{target.template||t('mappings.targetTemplateMissing')}</strong>{Object.keys(target.fields).length?<dl>{Object.entries(target.fields).map(([field,value])=><div key={field}><dt>{field}</dt><dd>{value||t('emptyValue')}</dd></div>)}</dl>:<p>{t('mappings.noFields')}</p>}</section>)}</div>}
  </details>
 </div>
}

function makeTabs(groups:OnAirGroup[],t:(key:string,options?:Record<string,unknown>)=>string):Tab[]{
 const invited=groups.filter(group=>group.kind==='invited')
 const ordered=[...invited,...groups.filter(group=>group.kind==='beta'),...groups.filter(group=>group.kind!=='invited'&&group.kind!=='beta')]
 if(!invited.length){ordered.unshift({id:'__onair-empty-invited__',name:'',kind:'invited',titles:[],persons:[],locations:[],phones:[]})}
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

function sum(groups:OnAirGroup[],key:'titles'|'persons'|'locations'|'phones'){return groups.reduce((total,group)=>total+group[key].length,0)}
function formatLoadedAt(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString()}
