import type {ReceivedRequest} from '../../shared/ingress/contracts'
import type {MosMappingConfig} from '../../shared/settings/mosMappings'

export interface MosSuggestions {templates:string[];paramsByTemplate:Record<string,string[]>;allParams:string[]}
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const validParams=(value:unknown):Record<string,string>|null=>{
 if(value===undefined)return {}
 if(!isRecord(value))return null
 const entries=Object.entries(value)
 if(entries.some(([key,item])=>!key.trim()||typeof item!=='string'))return null
 return value as Record<string,string>
}

/** Suggestions come only from accepted, well-formed MOS PLAY requests and saved source mappings. */
export function collectMosSuggestions(requests:ReceivedRequest[],config:MosMappingConfig):MosSuggestions{
 const templates=new Set<string>(),byTemplate=new Map<string,Set<string>>()
 const addParams=(template:string,params:Record<string,string>)=>{
  let names=byTemplate.get(template);if(!names){names=new Set();byTemplate.set(template,names)}
  for(const name of Object.keys(params))names.add(name)
 }
 for(const section of config.sections)for(const source of section.sources){
  const template=source.template;if(!template.trim())continue
  templates.add(template);addParams(template,Object.fromEntries(source.fields.filter(field=>field.param.trim()).map(field=>[field.param,field.param])))
 }
 for(const request of requests){
  if(!request.accepted||!isRecord(request.body)||request.body.type!=='mos-play')continue
  const template=request.body.template
  if(typeof template!=='string'||!template.trim())continue
  const params=validParams(request.body.params);if(params===null)continue
  templates.add(template);addParams(template,params)
 }
 const paramsByTemplate=Object.fromEntries([...byTemplate].map(([template,names])=>[template,[...names].sort((a,b)=>a.localeCompare(b))]))
 return {templates:[...templates].sort((a,b)=>a.localeCompare(b)),paramsByTemplate,allParams:[...new Set(Object.values(paramsByTemplate).flat())].sort((a,b)=>a.localeCompare(b))}
}
