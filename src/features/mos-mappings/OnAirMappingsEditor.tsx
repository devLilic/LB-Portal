import { useEffect, useMemo, useRef, useState } from 'react'
import type { MosProject } from '../../shared/settings/mosProjects'
import type { OnAirSnapshot } from '../../shared/onair/contracts'
import { getOnAirEffectiveTemplate, getOnAirMappingIssues, onAirSourceFields, type OnAirGraphicKind, type OnAirGraphicMapping } from '../../shared/onair/mappings'
import './OnAirMappingsEditor.css'

const makeId=()=>globalThis.crypto?.randomUUID?.()??`onair-${Date.now()}-${Math.random().toString(36).slice(2)}`
const kinds:OnAirGraphicKind[]=['titles','persons','locations','phones']
type T=(key:string,options?:Record<string,unknown>)=>string

export default function OnAirMappingsEditor({project,t,onChange}:{project:MosProject;t:T;onChange:(value:OnAirGraphicMapping[])=>void}){
 const [snapshot,setSnapshot]=useState<OnAirSnapshot|null>(null)
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading')
 const [reload,setReload]=useState(0)
 const [selectedSource,setSelectedSource]=useState('')
 useEffect(()=>{let live=true;setSnapshot(null);setSelectedSource('');setState('loading');void window.onAirApi.getSnapshot(project.id).then(value=>{if(live){setSnapshot(value.snapshot);setState('ready')}}).catch(()=>{if(live){setSnapshot(null);setState('error')}});return()=>{live=false}},[project.id,reload])
 const projectSnapshot=snapshot?.projectId===project.id?snapshot:null
 const detected=useMemo(()=>{
  const templates:Record<OnAirGraphicKind,string[]>={
   titles:projectSnapshot?.groups.flatMap(group=>group.titles.map(row=>row.template))??[],
   persons:projectSnapshot?.groups.flatMap(group=>group.persons.map(row=>row.template))??[],
   locations:projectSnapshot?.groups.flatMap(group=>group.locations.map(row=>getOnAirEffectiveTemplate('locations',row.template,project.onAirDefaultTemplates)))??[],
   phones:projectSnapshot?.groups.flatMap(group=>group.phones.map(row=>getOnAirEffectiveTemplate('phones',row.template,project.onAirDefaultTemplates)))??[],
  }
  return kinds.flatMap(kind=>[...new Set(templates[kind].filter(template=>template.trim()))].map(template=>({kind,template})))
 },[projectSnapshot,project.onAirDefaultTemplates])
 const mappings=project.onAirMappings??[]
 const issues=getOnAirMappingIssues(mappings,project.mappings)
 const update=(id:string,fn:(value:OnAirGraphicMapping)=>OnAirGraphicMapping)=>onChange(mappings.map(item=>item.id===id?fn(item):item))
 const add=(kind:OnAirGraphicKind,template:string)=>{if(mappings.some(item=>item.kind===kind&&item.sourceTemplate===template))return;onChange([...mappings,{id:makeId(),kind,sourceTemplate:template,sectionId:'',fields:[]}])}
 const addSelected=()=>{try{const [kind,template]=JSON.parse(selectedSource) as [OnAirGraphicKind,string];if(detected.some(item=>item.kind===kind&&item.template===template))add(kind,template);setSelectedSource('')}catch{}}
 return <section className="onair-mappings" aria-labelledby="onair-mappings-title">
  <header className="onair-mappings-heading"><div><h3 id="onair-mappings-title">{t('mos.onAirMappings.title')}</h3><p>{t('mos.onAirMappings.help')}</p></div><button type="button" onClick={()=>setReload(value=>value+1)}>{t('mos.onAirMappings.reload')}</button></header>
  {state==='loading'&&<p role="status">{t('mos.onAirMappings.loading')}</p>}{state==='error'&&<p role="alert">{t('mos.onAirMappings.loadError')}</p>}
  {state==='ready'&&!projectSnapshot&&<p className="onair-mappings-empty">{t('mos.onAirMappings.noSnapshot')}</p>}
  {state==='ready'&&projectSnapshot&&detected.length===0&&<p className="onair-mappings-empty">{t('mos.onAirMappings.noTemplates')}</p>}
  {detected.length>0&&<div className="onair-mapping-add"><label>{t('mos.onAirMappings.source')}<select disabled={state!=='ready'||!projectSnapshot} value={selectedSource} onChange={event=>setSelectedSource(event.target.value)}><option value="">{t('mos.onAirMappings.chooseSource')}</option>{detected.map(item=><option key={JSON.stringify([item.kind,item.template])} value={JSON.stringify([item.kind,item.template])}>{t(`mos.onAirMappings.kinds.${item.kind}`)} · {item.template}</option>)}</select></label><button type="button" disabled={state!=='ready'||!projectSnapshot||!selectedSource} onClick={addSelected}>{t('mos.onAirMappings.add')}</button></div>}
  {mappings.length===0&&<p className="onair-mappings-empty">{t('mos.onAirMappings.empty')}</p>}
  <div className="onair-mapping-list">{mappings.map((mapping,index)=>{const section=project.mappings.sections.find(item=>item.id===mapping.sectionId);const options=onAirSourceFields[mapping.kind]??[];return <article className="onair-mapping-card" key={mapping.id}>
   <header><div><strong>{t(`mos.onAirMappings.kinds.${mapping.kind}`)} · {mapping.sourceTemplate}</strong><span>{t('mos.onAirMappings.sourceReadOnly')}</span></div><button type="button" className="danger" onClick={()=>onChange(mappings.filter(item=>item.id!==mapping.id))}>{t('mos.onAirMappings.remove')}</button></header>
   {issues.filter(issue=>issue.path.startsWith(`onAirMappings[${index}]`)).map((issue,n)=><p className="onair-mapping-issue" role="alert" key={`${issue.path}-${n}`}>{t(`mos.onAirMappings.validation.${issue.code}`,{defaultValue:t('mos.validation.invalidStructure')})}</p>)}
   <label>{t('mos.onAirMappings.section')}<select value={mapping.sectionId} onChange={event=>update(mapping.id,value=>({...value,sectionId:event.target.value,fields:value.fields.map(field=>({...field,targetFields:{}}))}))}><option value="">{t('mos.onAirMappings.chooseSection')}</option>{project.mappings.sections.map(item=><option key={item.id} value={item.id}>{item.name||t('mos.unnamed')}</option>)}</select></label>
   {!section&&<p className="onair-mapping-empty">{t('mos.onAirMappings.noSection')}</p>}
   {section&&<><div className="onair-mapping-targets"><strong>{t('mos.onAirMappings.targets')}</strong>{section.targets.map(target=><span key={target.id}>{target.template||t('mos.target')}</span>)}</div>
    {mapping.fields.map(field=><div className={`onair-field-row ${section.targets.length===1?'single-target':'paired-targets'}`} key={field.id}><label>{t('mos.onAirMappings.sourceField')}<select value={field.sourceField} onChange={event=>update(mapping.id,value=>({...value,fields:value.fields.map(item=>item.id===field.id?{...item,sourceField:event.target.value}:item)}))}><option value="">{t('mos.onAirMappings.chooseField')}</option>{options.map(option=><option key={option} value={option}>{t(`mos.onAirMappings.fields.${option}`)}</option>)}</select></label>{section.targets.map(target=><label key={target.id}>{target.template||t('mos.target')}<DestinationFieldsInput value={field.targetFields[target.id]??[]} placeholder={t('mos.onAirMappings.destinationPlaceholder')} onChange={destinations=>update(mapping.id,value=>{const targetFields={...value.fields.find(item=>item.id===field.id)!.targetFields};if(destinations.length)targetFields[target.id]=destinations;else delete targetFields[target.id];return {...value,fields:value.fields.map(item=>item.id===field.id?{...item,targetFields}:item)}})}/><small>{t('mos.onAirMappings.destinationHelp')}</small></label>)}<button type="button" aria-label={t('mos.onAirMappings.removeField')} onClick={()=>update(mapping.id,value=>({...value,fields:value.fields.filter(item=>item.id!==field.id)}))}>×</button></div>)}
    <button type="button" className="secondary" onClick={()=>update(mapping.id,value=>({...value,fields:[...value.fields,{id:makeId(),sourceField:'',targetFields:{}}]}))}>{t('mos.onAirMappings.addField')}</button>
   </>}
  </article>})}</div>
 </section>
}

function DestinationFieldsInput({value,placeholder,onChange}:{value:string[];placeholder:string;onChange:(destinations:string[])=>void}){
 const normalized=value.join('\n')
 const [text,setText]=useState(normalized)
 const lastEmitted=useRef<string|null>(null)
 useEffect(()=>{if(lastEmitted.current===normalized){lastEmitted.current=null;return}setText(normalized)},[normalized])
 return <textarea rows={2} value={text} placeholder={placeholder} onChange={event=>{const next=event.target.value;setText(next);const destinations=next.split('\n').map(item=>item.trim()).filter(Boolean);lastEmitted.current=destinations.join('\n');onChange(destinations)}}/>
}
