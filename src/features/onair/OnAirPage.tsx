import {useCallback,useEffect,useRef,useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {OnAirError,OnAirGroup,OnAirProjectSummary,OnAirState} from '../../shared/onair/contracts'
import './onair.css'

type Props={selectedProjectId:string|null;onSelectedProjectIdChange:(id:string|null)=>void}

export default function OnAirPage({selectedProjectId,onSelectedProjectIdChange}:Props){
 const {t}=useTranslation('onair')
 const [projects,setProjects]=useState<OnAirProjectSummary[]>([])
 const [state,setState]=useState<OnAirState|null>(null)
 const [listError,setListError]=useState(false)
 const [loading,setLoading]=useState(true)
 const [refreshing,setRefreshing]=useState(false)
 const sequence=useRef(0)
 const mounted=useRef(false)
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
  onSelectedProjectIdChange(id)
 }
 const snapshot=state?.projectId===selectedProjectId?state.snapshot:null
 const folderPath=state?.projectId===selectedProjectId?state.folderPath:project?.folderPath??null
 const error=state?.projectId===selectedProjectId?state.error:null
 const busy=refreshing||!!(state?.projectId===selectedProjectId&&state.busy)

 return <section className="onair-page" aria-labelledby="onair-title">
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
   {snapshot&&<section className="onair-snapshot" aria-label={t('snapshot.title')}>
    <div className="onair-counts"><span>{t('counts.groups',{count:snapshot.groups.length})}</span><span>{t('counts.titles',{count:sum(snapshot.groups,'titles')})}</span><span>{t('counts.persons',{count:sum(snapshot.groups,'persons')})}</span><span>{t('counts.locations',{count:sum(snapshot.groups,'locations')})}</span><span>{t('counts.phones',{count:sum(snapshot.groups,'phones')})}</span></div>
    {snapshot.groups.length? <div className="onair-groups">{snapshot.groups.map((group,index)=><GroupCard key={`${group.id}-${index}`} group={group} t={t}/>)}</div>:<section className="onair-empty"><h3>{t('empty.title')}</h3><p>{t('empty.body')}</p></section>}
   </section>}
  </>}
 </section>
}

function GroupCard({group,t}:{group:OnAirGroup;t:(key:string,options?:Record<string,unknown>)=>string}){
 return <article className={`onair-group onair-group-${group.kind}`}>
  <header className="onair-group-heading"><div><span className="onair-group-kind">{t(`groupKinds.${group.kind}`)}</span><h3>{group.name||t('unnamedGroup')}</h3></div><span className="onair-group-total">{group.titles.length+group.persons.length+group.locations.length+group.phones.length}</span></header>
  <div className="onair-group-columns">
   <section className="onair-list-block"><h4>{t('sections.titles')} <small>{group.titles.length}</small></h4>{group.titles.length?group.titles.map(item=><div className="onair-item" key={item.id}><div className="onair-item-heading"><strong>{item.nr&&<span>{item.nr}</span>}{item.title||t('emptyValue')}</strong><span className="onair-template">{item.template||t('emptyValue')}</span></div>{item.supratitle&&<p className="onair-secondary-text">{item.supratitle}</p>}</div>):<p className="onair-none">{t('none')}</p>}</section>
   <section className="onair-list-block"><h4>{t('sections.persons')} <small>{group.persons.length}</small></h4>{group.persons.length?group.persons.map(item=><div className="onair-item" key={item.id}><div className="onair-item-heading"><strong>{item.name||t('emptyValue')}</strong><span className="onair-template">{item.template||t('emptyValue')}</span></div>{item.role&&<p className="onair-secondary-text">{item.role}</p>}</div>):<p className="onair-none">{t('none')}</p>}</section>
  </div>
  {(group.locations.length>0||group.phones.length>0)&&<div className="onair-group-extra">
   {group.locations.length>0&&<section className="onair-list-block"><h4>{t('sections.locations')} <small>{group.locations.length}</small></h4>{group.locations.map(item=><div className="onair-item" key={item.id}><p className="onair-preserved-text">{item.location||t('emptyValue')}</p></div>)}</section>}
   {group.phones.length>0&&<section className="onair-list-block"><h4>{t('sections.phones')} <small>{group.phones.length}</small></h4>{group.phones.map(item=><div className="onair-item" key={item.id}><strong>{item.name||t('emptyValue')}</strong>{item.role&&<p className="onair-secondary-text">{item.role}</p>}{item.imagePath&&<p className="onair-image-path"><span>{t('imagePath')}</span><code>{item.imagePath}</code></p>}</div>)}</section>}
  </div>}
 </article>
}

function sum(groups:OnAirGroup[],key:'titles'|'persons'|'locations'|'phones'){return groups.reduce((total,group)=>total+group[key].length,0)}
function formatLoadedAt(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString()}
